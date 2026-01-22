/**
 * Installer - Multi-Agent installer
 *
 * Supports two installation modes:
 * - symlink: Canonical location (.agents/skills/) + symlinks to each agent directory
 * - copy: Direct copy to each agent directory
 *
 * Reference: https://github.com/vercel-labs/add-skill/blob/main/src/installer.ts
 */

import * as fs from 'node:fs';
import { homedir, platform } from 'node:os';
import * as path from 'node:path';
import type { AgentType } from './agent-registry.js';
import { getAgentConfig } from './agent-registry.js';

/**
 * Installation mode
 */
export type InstallMode = 'symlink' | 'copy';

/**
 * Installation result
 */
export interface InstallResult {
  /** Whether successful */
  success: boolean;
  /** Installation path */
  path: string;
  /** Canonical path (symlink mode) */
  canonicalPath?: string;
  /** Installation mode */
  mode: InstallMode;
  /** Whether symlink failed (fallback to copy) */
  symlinkFailed?: boolean;
  /** Error message */
  error?: string;
}

/**
 * Installation options
 */
export interface InstallerOptions {
  /** Global installation */
  global?: boolean;
  /** Current working directory */
  cwd?: string;
  /** Installation mode */
  mode?: InstallMode;
}

const AGENTS_DIR = '.agents';
const SKILLS_SUBDIR = 'skills';

/**
 * Sanitize filename to prevent path traversal attacks
 */
function sanitizeName(name: string): string {
  // Remove path separators and special characters
  let sanitized = name.replace(/[/\\:\0]/g, '');
  // Remove leading and trailing dots and spaces
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');
  // Remove leading dots
  sanitized = sanitized.replace(/^\.+/, '');

  if (!sanitized || sanitized.length === 0) {
    sanitized = 'unnamed-skill';
  }

  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }

  return sanitized;
}

/**
 * Validate path safety
 */
function isPathSafe(basePath: string, targetPath: string): boolean {
  const normalizedBase = path.normalize(path.resolve(basePath));
  const normalizedTarget = path.normalize(path.resolve(targetPath));

  return (
    normalizedTarget.startsWith(normalizedBase + path.sep) || normalizedTarget === normalizedBase
  );
}

/**
 * Get canonical skills directory path
 */
function getCanonicalSkillsDir(isGlobal: boolean, cwd?: string): string {
  const baseDir = isGlobal ? homedir() : cwd || process.cwd();
  return path.join(baseDir, AGENTS_DIR, SKILLS_SUBDIR);
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Remove file or directory
 */
function remove(targetPath: string): void {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

/**
 * Copy directory
 */
function copyDirectory(src: string, dest: string, options?: { exclude?: string[] }): void {
  const exclude = new Set(options?.exclude || ['README.md', 'metadata.json', '.reskill-commit']);

  ensureDir(dest);

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    // Skip files starting with _ and files in exclude list
    if (exclude.has(entry.name) || entry.name.startsWith('_')) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath, options);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Create symbolic link
 *
 * @returns true if successful, false if needs to fallback to copy
 */
async function createSymlink(target: string, linkPath: string): Promise<boolean> {
  try {
    // Check existing link
    try {
      const stats = fs.lstatSync(linkPath);
      if (stats.isSymbolicLink()) {
        const existingTarget = fs.readlinkSync(linkPath);
        if (path.resolve(existingTarget) === path.resolve(target)) {
          return true;
        }
        fs.rmSync(linkPath);
      } else {
        fs.rmSync(linkPath, { recursive: true });
      }
    } catch (err: unknown) {
      // ELOOP = circular symlink, ENOENT = does not exist
      if (err && typeof err === 'object' && 'code' in err) {
        if ((err as { code: string }).code === 'ELOOP') {
          try {
            fs.rmSync(linkPath, { force: true });
          } catch {
            // If unable to delete, symlink creation will fail and trigger copy fallback
          }
        }
      }
      // For ENOENT or other errors, continue trying to create symlink
    }

    // Ensure parent directory exists
    const linkDir = path.dirname(linkPath);
    ensureDir(linkDir);

    // Calculate relative path
    const relativePath = path.relative(linkDir, target);

    // Windows uses junction, other systems use default
    const symlinkType = platform() === 'win32' ? 'junction' : undefined;

    fs.symlinkSync(relativePath, linkPath, symlinkType);
    return true;
  } catch {
    return false;
  }
}

/**
 * Installer class - Multi-Agent installer
 */
export class Installer {
  private cwd: string;
  private isGlobal: boolean;

  constructor(options: { cwd?: string; global?: boolean } = {}) {
    this.cwd = options.cwd || process.cwd();
    this.isGlobal = options.global || false;
  }

  /**
   * Get canonical installation path
   */
  getCanonicalPath(skillName: string): string {
    const sanitized = sanitizeName(skillName);
    const canonicalBase = getCanonicalSkillsDir(this.isGlobal, this.cwd);
    return path.join(canonicalBase, sanitized);
  }

  /**
   * Get agent's skill installation path
   */
  getAgentSkillPath(skillName: string, agentType: AgentType): string {
    const agent = getAgentConfig(agentType);
    const sanitized = sanitizeName(skillName);
    const agentBase = this.isGlobal ? agent.globalSkillsDir : path.join(this.cwd, agent.skillsDir);
    return path.join(agentBase, sanitized);
  }

  /**
   * Install skill to specified agent
   *
   * @param sourcePath - Skill source directory path
   * @param skillName - Skill name
   * @param agentType - Target agent type
   * @param options - Installation options
   */
  async installForAgent(
    sourcePath: string,
    skillName: string,
    agentType: AgentType,
    options: { mode?: InstallMode } = {},
  ): Promise<InstallResult> {
    const agent = getAgentConfig(agentType);
    const installMode = options.mode || 'symlink';
    const sanitized = sanitizeName(skillName);

    // Canonical location
    const canonicalBase = getCanonicalSkillsDir(this.isGlobal, this.cwd);
    const canonicalDir = path.join(canonicalBase, sanitized);

    // Agent specific location
    const agentBase = this.isGlobal ? agent.globalSkillsDir : path.join(this.cwd, agent.skillsDir);
    const agentDir = path.join(agentBase, sanitized);

    // Validate path safety
    if (!isPathSafe(canonicalBase, canonicalDir)) {
      return {
        success: false,
        path: agentDir,
        mode: installMode,
        error: 'Invalid skill name: potential path traversal detected',
      };
    }

    if (!isPathSafe(agentBase, agentDir)) {
      return {
        success: false,
        path: agentDir,
        mode: installMode,
        error: 'Invalid skill name: potential path traversal detected',
      };
    }

    try {
      // Copy mode: directly copy to agent location
      if (installMode === 'copy') {
        ensureDir(agentDir);
        remove(agentDir);
        copyDirectory(sourcePath, agentDir);

        return {
          success: true,
          path: agentDir,
          mode: 'copy',
        };
      }

      // Symlink mode: copy to canonical location, then create symlink
      ensureDir(canonicalDir);
      remove(canonicalDir);
      copyDirectory(sourcePath, canonicalDir);

      const symlinkCreated = await createSymlink(canonicalDir, agentDir);

      if (!symlinkCreated) {
        // Symlink failed, fallback to copy
        try {
          remove(agentDir);
        } catch {
          // Ignore cleanup errors
        }
        ensureDir(agentDir);
        copyDirectory(sourcePath, agentDir);

        return {
          success: true,
          path: agentDir,
          canonicalPath: canonicalDir,
          mode: 'symlink',
          symlinkFailed: true,
        };
      }

      return {
        success: true,
        path: agentDir,
        canonicalPath: canonicalDir,
        mode: 'symlink',
      };
    } catch (error) {
      return {
        success: false,
        path: agentDir,
        mode: installMode,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Install skill to multiple agents
   */
  async installToAgents(
    sourcePath: string,
    skillName: string,
    targetAgents: AgentType[],
    options: { mode?: InstallMode } = {},
  ): Promise<Map<AgentType, InstallResult>> {
    const results = new Map<AgentType, InstallResult>();

    for (const agent of targetAgents) {
      const result = await this.installForAgent(sourcePath, skillName, agent, options);
      results.set(agent, result);
    }

    return results;
  }

  /**
   * Check if skill is installed to specified agent
   */
  isInstalled(skillName: string, agentType: AgentType): boolean {
    const skillPath = this.getAgentSkillPath(skillName, agentType);
    return fs.existsSync(skillPath);
  }

  /**
   * Uninstall skill from specified agent
   */
  uninstallFromAgent(skillName: string, agentType: AgentType): boolean {
    const skillPath = this.getAgentSkillPath(skillName, agentType);

    if (!fs.existsSync(skillPath)) {
      return false;
    }

    remove(skillPath);
    return true;
  }

  /**
   * Uninstall skill from multiple agents
   */
  uninstallFromAgents(skillName: string, targetAgents: AgentType[]): Map<AgentType, boolean> {
    const results = new Map<AgentType, boolean>();

    for (const agent of targetAgents) {
      results.set(agent, this.uninstallFromAgent(skillName, agent));
    }

    // Also delete canonical location
    const canonicalPath = this.getCanonicalPath(skillName);
    if (fs.existsSync(canonicalPath)) {
      remove(canonicalPath);
    }

    return results;
  }

  /**
   * Get all skills installed to specified agent
   */
  listInstalledSkills(agentType: AgentType): string[] {
    const agent = getAgentConfig(agentType);
    const skillsDir = this.isGlobal ? agent.globalSkillsDir : path.join(this.cwd, agent.skillsDir);

    if (!fs.existsSync(skillsDir)) {
      return [];
    }

    return fs
      .readdirSync(skillsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name);
  }
}

export default Installer;
