/**
 * SkillValidator - Validate skills for publishing
 *
 * Following agentskills.io specification: https://agentskills.io/specification
 *
 * Key points:
 * - SKILL.md is the SOLE source of metadata (name, description, version, etc.)
 * - skill.json is NOT used - all metadata comes from SKILL.md frontmatter
 * - Version defaults to "0.0.0" if not specified in SKILL.md
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as semver from 'semver';
import type { SkillJson } from '../types/index.js';
import { isMacMetadataPath } from './extractor.js';
import { type ParsedSkill, parseSkillMdFile } from './skill-parser.js';

// ============================================================================
// Types
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  suggestion?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface LoadedSkill {
  path: string;
  /** Skill metadata synthesized from SKILL.md (for backward compatibility with publish API) */
  skillJson: SkillJson | null;
  /** SKILL.md parsed content (sole source of metadata) */
  skillMd: ParsedSkill | null;
  readme: string | null;
  files: string[];
}

// ============================================================================
// Constants
// ============================================================================

const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_KEYWORDS = 10;
const SINGLE_CHAR_NAME_PATTERN = /^[a-z0-9]$/;
const DEFAULT_VERSION = '0.0.0';

// Default files to include in publish
const DEFAULT_FILES = ['SKILL.md', 'README.md', 'LICENSE'];

// ============================================================================
// SkillValidator Class
// ============================================================================

export class SkillValidator {
  /**
   * Validate skill name format
   *
   * Requirements:
   * - Lowercase letters, numbers, and hyphens only
   * - 1-64 characters
   * - Cannot start or end with hyphen
   * - Cannot have consecutive hyphens
   */
  validateName(name: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (!name) {
      errors.push({
        field: 'name',
        message: 'Skill name is required',
        suggestion: 'Add "name" field to SKILL.md frontmatter',
      });
      return { valid: false, errors, warnings: [] };
    }

    if (name.length > MAX_NAME_LENGTH) {
      errors.push({
        field: 'name',
        message: `Skill name must be at most ${MAX_NAME_LENGTH} characters`,
        suggestion: `Shorten the name to ${MAX_NAME_LENGTH} characters or less`,
      });
    }

    // Check for uppercase
    if (/[A-Z]/.test(name)) {
      errors.push({
        field: 'name',
        message: 'Skill name must be lowercase',
        suggestion: `Change "${name}" to "${name.toLowerCase()}"`,
      });
    }

    // Check for invalid characters
    if (/[^a-z0-9-]/.test(name)) {
      errors.push({
        field: 'name',
        message: 'Skill name can only contain lowercase letters, numbers, and hyphens',
        suggestion: 'Remove special characters from the name',
      });
    }

    // Check pattern for multi-char names
    if (name.length === 1) {
      if (!SINGLE_CHAR_NAME_PATTERN.test(name)) {
        errors.push({
          field: 'name',
          message: 'Single character name must be a lowercase letter or number',
        });
      }
    } else if (name.length > 1) {
      // Check start/end with hyphen
      if (name.startsWith('-')) {
        errors.push({
          field: 'name',
          message: 'Skill name cannot start with a hyphen',
        });
      }
      if (name.endsWith('-')) {
        errors.push({
          field: 'name',
          message: 'Skill name cannot end with a hyphen',
        });
      }
      // Check consecutive hyphens
      if (/--/.test(name)) {
        errors.push({
          field: 'name',
          message: 'Skill name cannot contain consecutive hyphens',
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings: [] };
  }

  /**
   * Validate version format (semver)
   */
  validateVersion(version: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (!version) {
      errors.push({
        field: 'version',
        message: 'Version is required',
        suggestion: 'Add "version" field to SKILL.md frontmatter (e.g., "1.0.0")',
      });
      return { valid: false, errors, warnings: [] };
    }

    // Check for v prefix
    if (version.startsWith('v')) {
      errors.push({
        field: 'version',
        message: 'Version should not have "v" prefix',
        suggestion: `Change "${version}" to "${version.slice(1)}"`,
      });
      return { valid: false, errors, warnings: [] };
    }

    if (!semver.valid(version)) {
      errors.push({
        field: 'version',
        message: `Invalid version format: "${version}". Must follow semver (x.y.z)`,
        suggestion: 'Use format like "1.0.0" or "1.0.0-beta.1"',
      });
    }

    return { valid: errors.length === 0, errors, warnings: [] };
  }

  /**
   * Validate description
   *
   * Following agentskills.io specification:
   * - Max 1024 characters
   * - Non-empty
   */
  validateDescription(description: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (!description) {
      errors.push({
        field: 'description',
        message: 'Description is required',
        suggestion: 'Add "description" field to SKILL.md frontmatter',
      });
      return { valid: false, errors, warnings: [] };
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push({
        field: 'description',
        message: `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`,
      });
    }

    // Note: angle brackets are allowed per agentskills.io spec

    return { valid: errors.length === 0, errors, warnings: [] };
  }

  /**
   * Load skill information from directory
   *
   * Following agentskills.io specification:
   * - SKILL.md is the SOLE source of metadata
   * - skillJson is synthesized from SKILL.md for backward compatibility with publish API
   */
  loadSkill(skillPath: string): LoadedSkill {
    const result: LoadedSkill = {
      path: skillPath,
      skillJson: null,
      skillMd: null,
      readme: null,
      files: [],
    };

    // Load SKILL.md (sole source of metadata)
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    if (fs.existsSync(skillMdPath)) {
      try {
        result.skillMd = parseSkillMdFile(skillMdPath);
        // Always synthesize skillJson from SKILL.md for backward compatibility
        if (result.skillMd) {
          result.skillJson = this.synthesizeSkillJson(result.skillMd);
        }
      } catch {
        // Will be caught in validation
      }
    }

    // Load README.md
    const readmePath = path.join(skillPath, 'README.md');
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, 'utf-8');
      // Only keep first 500 chars as preview
      result.readme = content.slice(0, 500);
    }

    // Scan files (use files array from SKILL.md metadata if available)
    const filesPattern = result.skillMd?.metadata?.files as string[] | undefined;
    result.files = this.scanFiles(skillPath, filesPattern);

    return result;
  }

  /**
   * Synthesize a SkillJson object from SKILL.md frontmatter
   *
   * This creates a SkillJson representation from SKILL.md for backward compatibility
   * with the publish API. All metadata comes from SKILL.md.
   */
  private synthesizeSkillJson(skillMd: ParsedSkill): SkillJson {
    // Extract version: first from top-level frontmatter, then from metadata, then default
    const version = skillMd.version || (skillMd.metadata?.version as string) || DEFAULT_VERSION;
    // Only include keywords if it's a valid array
    const keywords = Array.isArray(skillMd.metadata?.keywords)
      ? (skillMd.metadata.keywords as string[])
      : undefined;

    return {
      name: skillMd.name,
      version,
      description: skillMd.description,
      license: skillMd.license,
      keywords,
      entry: 'SKILL.md',
    };
  }

  /**
   * Scan files to include in publish
   *
   * If includePatterns is specified, only include those files/directories.
   * Otherwise, scan all files in the directory (excluding ignored patterns).
   */
  private scanFiles(skillPath: string, includePatterns?: string[]): string[] {
    const files: string[] = [];
    const seen = new Set<string>();

    // If includePatterns specified, use selective scanning
    if (includePatterns && includePatterns.length > 0) {
      // Add default files first
      for (const file of DEFAULT_FILES) {
        const filePath = path.join(skillPath, file);
        if (fs.existsSync(filePath) && !seen.has(file)) {
          files.push(file);
          seen.add(file);
        }
      }

      // Add files from SKILL.md metadata.files array
      for (const pattern of includePatterns) {
        const targetPath = path.join(skillPath, pattern);

        if (fs.existsSync(targetPath)) {
          const stat = fs.statSync(targetPath);
          if (stat.isDirectory()) {
            // Recursively add all files in directory
            this.addFilesFromDir(skillPath, pattern, files, seen);
          } else if (!seen.has(pattern)) {
            files.push(pattern);
            seen.add(pattern);
          }
        }
      }
    } else {
      // No includePatterns: scan entire directory (default behavior)
      this.addFilesFromDir(skillPath, '', files, seen);
    }

    return files;
  }

  /**
   * Patterns to ignore when scanning directories
   */
  private static readonly IGNORE_PATTERNS = [
    '.git',
    '.svn',
    '.hg',
    'node_modules',
    '.DS_Store',
    'Thumbs.db',
    '.idea',
    '.vscode',
    '*.log',
    '*.tmp',
    '*.swp',
    '*.bak',
  ];

  /**
   * Check if a file/directory should be ignored
   */
  private shouldIgnore(name: string): boolean {
    // macOS metadata (AppleDouble ._<name>, __MACOSX) — must not enter the
    // files list at all so that dry-run output, size calc, integrity hash and
    // the packed tarball all agree on the same file set (#3062)
    if (name.startsWith('._') || name === '__MACOSX') {
      return true;
    }
    for (const pattern of SkillValidator.IGNORE_PATTERNS) {
      if (pattern.startsWith('*')) {
        // Wildcard pattern (e.g., *.log)
        const ext = pattern.slice(1);
        if (name.endsWith(ext)) {
          return true;
        }
      } else if (name === pattern) {
        return true;
      }
    }
    return false;
  }

  /**
   * Recursively add files from directory
   */
  private addFilesFromDir(
    basePath: string,
    dirPath: string,
    files: string[],
    seen: Set<string>,
  ): void {
    const fullPath = dirPath ? path.join(basePath, dirPath) : basePath;
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip ignored files/directories
      if (this.shouldIgnore(entry.name)) {
        continue;
      }

      const relativePath = dirPath ? path.join(dirPath, entry.name) : entry.name;
      if (entry.isDirectory()) {
        this.addFilesFromDir(basePath, relativePath, files, seen);
      } else if (!seen.has(relativePath)) {
        files.push(relativePath);
        seen.add(relativePath);
      }
    }
  }

  /**
   * Validate a skill directory for publishing
   *
   * Following agentskills.io specification:
   * - SKILL.md is the SOLE source of metadata
   * - name and description are REQUIRED in frontmatter
   */
  validate(skillPath: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check SKILL.md exists (REQUIRED per spec)
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      errors.push({
        field: 'SKILL.md',
        message: 'SKILL.md not found. This file is required for publishing.',
        suggestion: 'Create a SKILL.md file with name and description in YAML frontmatter',
      });
      return { valid: false, errors, warnings };
    }

    // Parse SKILL.md
    let skillMd: ParsedSkill | null;
    try {
      skillMd = parseSkillMdFile(skillMdPath);
      if (!skillMd) {
        errors.push({
          field: 'SKILL.md',
          message: 'SKILL.md must have valid YAML frontmatter with name and description',
          suggestion:
            'Add frontmatter: ---\\nname: your-skill\\ndescription: Your description\\n---',
        });
        return { valid: false, errors, warnings };
      }
    } catch (error) {
      errors.push({
        field: 'SKILL.md',
        message: `Failed to parse SKILL.md: ${(error as Error).message}`,
        suggestion: 'Check the YAML frontmatter syntax is valid',
      });
      return { valid: false, errors, warnings };
    }

    // Validate name from SKILL.md
    const nameResult = this.validateName(skillMd.name);
    errors.push(...nameResult.errors);

    // Validate description from SKILL.md
    const descResult = this.validateDescription(skillMd.description);
    errors.push(...descResult.errors);

    // Check version in SKILL.md
    const skillMdVersion = skillMd.version || (skillMd.metadata?.version as string | undefined);
    if (!skillMdVersion) {
      warnings.push({
        field: 'version',
        message: `No version specified, defaulting to "${DEFAULT_VERSION}"`,
        suggestion: 'Add version in SKILL.md frontmatter',
      });
    } else {
      // Validate the version from SKILL.md
      const versionResult = this.validateVersion(skillMdVersion);
      errors.push(...versionResult.errors);
    }

    // Check keywords count (only if metadata.keywords is a valid array)
    const keywords = skillMd.metadata?.keywords;
    if (Array.isArray(keywords) && keywords.length > MAX_KEYWORDS) {
      warnings.push({
        field: 'keywords',
        message: `Too many keywords (${keywords.length}). Recommended max: ${MAX_KEYWORDS}`,
      });
    }

    // Check license
    if (!skillMd.license) {
      warnings.push({
        field: 'license',
        message: 'No license specified',
        suggestion: 'Add license in SKILL.md frontmatter',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate integrity hash for files
   *
   * Metadata entries (._*, __MACOSX/, .DS_Store) are excluded so the hashed
   * file set matches what createTarball actually packs (#3062).
   */
  generateIntegrity(skillPath: string, files: string[]): string {
    const hash = crypto.createHash('sha256');

    // Sort files for consistent ordering
    const sortedFiles = [...files]
      .filter((file) => !isMacMetadataPath(file))
      .sort();

    for (const file of sortedFiles) {
      const filePath = path.join(skillPath, file);
      if (fs.existsSync(filePath)) {
        hash.update(file);
        const content = fs.readFileSync(filePath);
        hash.update(content);
      }
    }

    return `sha256-${hash.digest('hex')}`;
  }
}

export default SkillValidator;
