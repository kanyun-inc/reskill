/**
 * publish command - Publish a skill to the registry
 *
 * Validates and publishes skill metadata to the reskill registry.
 * Use --dry-run to validate without actually publishing.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createInterface } from 'node:readline';
import { Command } from 'commander';
import * as semver from 'semver';
import { AuthManager } from '../../core/auth-manager.js';
import {
  type GitInfo,
  PublishError,
  Publisher,
  type PublishPayload,
} from '../../core/publisher.js';
import { RegistryClient, RegistryError } from '../../core/registry-client.js';
import {
  type LoadedSkill,
  SkillValidator,
  type ValidationResult,
} from '../../core/skill-validator.js';
import { logger } from '../../utils/logger.js';
import { resolveRegistry } from '../../utils/registry.js';
import { buildFullSkillName, getScopeForRegistry } from '../../utils/registry-scope.js';

// ============================================================================
// Types
// ============================================================================

interface PublishOptions {
  registry?: string;
  tag?: string;
  access?: 'public' | 'restricted';
  dryRun?: boolean;
  yes?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Blocked public registries - CLI publishing is not allowed to these registries.
 * Users should use the web interface at reskill.info to publish to the public registry.
 */
const BLOCKED_PUBLIC_REGISTRIES = [
  'reskill.info',
  'www.reskill.info',
  'registry.reskill.info',
  'api.reskill.info',
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build the full skill name for publishing
 *
 * Priority:
 * 1. If name already contains scope (e.g., "@scope/name"), use as-is
 * 2. If registry has a configured scope, use that scope
 * 3. Throw error if no scope configured (no fallback)
 *
 * @param name - Skill name (may or may not include scope)
 * @param registry - Registry URL
 * @param _userHandle - Deprecated, no longer used (kept for backward compatibility)
 * @returns Full skill name with scope (e.g., "@kanyun/planning-with-files")
 * @throws Error if registry has no configured scope
 *
 * @internal Exported for testing
 */
export function buildPublishSkillName(
  name: string,
  registry: string,
  _userHandle?: string,
): string {
  // If name already has scope, use as-is
  if (name.includes('/')) {
    return name;
  }

  // Get scope from registry configuration (required)
  const registryScope = getScopeForRegistry(registry);

  if (!registryScope) {
    throw new Error(`No scope configured for registry: ${registry}`);
  }

  return buildFullSkillName(registryScope, name);
}

/**
 * Check if a registry URL is a blocked public registry
 * @internal Exported for testing
 */
export function isBlockedPublicRegistry(registryUrl: string): boolean {
  try {
    const url = new URL(registryUrl);
    const hostname = url.hostname.toLowerCase();
    return BLOCKED_PUBLIC_REGISTRIES.some(
      (blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`),
    );
  } catch {
    // If URL parsing fails, check if the string contains blocked domains
    const lowerUrl = registryUrl.toLowerCase();
    return BLOCKED_PUBLIC_REGISTRIES.some((blocked) => lowerUrl.includes(blocked));
  }
}

/**
 * Validate that the registry is not a blocked public registry
 */
function validateRegistry(registry: string): void {
  if (isBlockedPublicRegistry(registry)) {
    logger.error('Publishing to the public registry is not supported via CLI');
    logger.newline();
    logger.log('The reskill CLI only supports publishing to private registries.');
    logger.log('To publish to the public registry, please use the web interface:');
    logger.log('  → https://reskill.info/submit');
    logger.newline();
    logger.log('For private registry publishing, configure your registry:');
    logger.log('  • --registry <your-private-registry-url>');
    logger.log('  • RESKILL_REGISTRY environment variable');
    logger.log('  • "defaults.publishRegistry" in skills.json');
    process.exit(1);
  }
}

/**
 * Check authentication
 */
function checkAuth(registry: string, dryRun: boolean): { token: string } | null {
  const authManager = new AuthManager();
  const token = authManager.getToken(registry);

  if (!token) {
    if (dryRun) {
      logger.debug('Not logged in (skipped for dry-run)');
      return null;
    }
    logger.error('Authentication required');
    logger.newline();
    logger.log('You must be logged in to publish skills.');
    logger.log("Run 'reskill login' to authenticate.");
    process.exit(1);
  }

  return { token };
}

/**
 * Display validation results
 */
function displayValidation(skill: LoadedSkill, validation: ValidationResult): void {
  logger.log('Validating skill...');

  // SKILL.md is the primary file per agentskills.io spec
  if (skill.skillMd) {
    logger.log('  ✓ SKILL.md found');
  } else {
    logger.log('  ✗ SKILL.md not found (required)');
  }

  // All metadata comes from SKILL.md
  if (skill.skillMd) {
    logger.log('  ✓ Metadata loaded from SKILL.md');
  }

  if (validation.valid && skill.skillMd) {
    // All metadata from SKILL.md
    const { name, version, description } = skill.skillMd;

    if (name) {
      logger.log(`  ✓ Name: ${name}`);
    }
    if (version) {
      logger.log(`  ✓ Version: ${version}`);
    }
    if (description) {
      const desc = description.length > 50 ? `${description.slice(0, 50)}...` : description;
      logger.log(`  ✓ Description: ${desc}`);
    }
  }

  // Display errors
  for (const err of validation.errors) {
    logger.log(`  ✗ ${err.field}: ${err.message}`);
  }
}

/**
 * Display git information
 */
function displayGitInfo(gitInfo: GitInfo): void {
  logger.newline();
  logger.log('Git information:');

  if (gitInfo.remoteUrl) {
    logger.log(`  ✓ Repository: ${gitInfo.remoteUrl}`);
  } else {
    logger.log('  ⚠ Repository: not configured');
  }

  if (gitInfo.tag) {
    logger.log(`  ✓ Tag: ${gitInfo.tag}`);
  } else {
    logger.log('  ⚠ Tag: none (using commit)');
  }

  if (gitInfo.currentCommit) {
    const shortCommit = gitInfo.currentCommit.slice(0, 7);
    const date = gitInfo.commitDate
      ? ` (${new Date(gitInfo.commitDate).toLocaleDateString()})`
      : '';
    logger.log(`  ✓ Commit: ${shortCommit}${date}`);
  }

  if (gitInfo.isDirty) {
    logger.log('  ⚠ Working tree has uncommitted changes');
  } else if (gitInfo.isRepo) {
    logger.log('  ✓ Working tree clean');
  }
}

/**
 * Display files to publish
 */
function displayFiles(skillPath: string, files: string[], publisher: Publisher): void {
  logger.newline();
  logger.log('Files to publish:');

  const maxFilesToShow = 10;
  const filesToShow = files.slice(0, maxFilesToShow);

  for (const file of filesToShow) {
    const filePath = path.join(skillPath, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      logger.log(`  • ${file} (${publisher.formatBytes(stats.size)})`);
    } else {
      logger.log(`  • ${file}`);
    }
  }

  if (files.length > maxFilesToShow) {
    logger.log(`  ... and ${files.length - maxFilesToShow} more files`);
  }

  const totalSize = publisher.calculateTotalSize(skillPath, files);
  logger.log(`  Total: ${files.length} file(s), ${publisher.formatBytes(totalSize)}`);
}

/**
 * Display metadata
 */
function displayMetadata(skill: LoadedSkill): void {
  // All metadata from SKILL.md
  const keywords = skill.skillMd?.metadata?.keywords as string[] | undefined;
  const license = skill.skillMd?.license;
  const compatibility = skill.skillMd?.compatibility;

  if (keywords || license || compatibility) {
    logger.newline();
    logger.log('Metadata:');

    if (keywords && keywords.length > 0) {
      logger.log(`  • Keywords: ${keywords.join(', ')}`);
    }

    if (license) {
      logger.log(`  • License: ${license}`);
    }

    if (compatibility) {
      // compatibility can be a string or an object
      if (typeof compatibility === 'string') {
        logger.log(`  • Compatibility: ${compatibility}`);
      } else {
        const compat = Object.entries(compatibility)
          .map(([k, v]) => `${k} ${v}`)
          .join(', ');
        logger.log(`  • Compatibility: ${compat}`);
      }
    }
  }
}

/**
 * Display validation errors in detail
 */
function displayValidationErrors(validation: ValidationResult): void {
  logger.newline();
  logger.error(`Validation failed with ${validation.errors.length} error(s):`);
  logger.newline();

  validation.errors.forEach((err, index) => {
    logger.log(`  ${index + 1}. ${err.field}: ${err.message}`);
    if (err.suggestion) {
      logger.log(`     → ${err.suggestion}`);
    }
  });
}

/**
 * Display warnings
 *
 * @param validation - Validation result
 * @param skipVersionWarning - If true, skip the version warning (user provided version interactively)
 */
function displayWarnings(validation: ValidationResult, skipVersionWarning = false): void {
  const warnings = skipVersionWarning
    ? validation.warnings.filter((w) => w.field !== 'version')
    : validation.warnings;

  if (warnings.length > 0) {
    logger.newline();
    logger.warn(`${warnings.length} warning(s):`);
    for (const warn of warnings) {
      logger.log(`  ⚠ ${warn.field}: ${warn.message}`);
      if (warn.suggestion) {
        logger.log(`    → ${warn.suggestion}`);
      }
    }
  }
}

/**
 * Parse user's confirmation answer
 *
 * Default is Yes - returns true for empty input or any input except 'n'/'no'
 *
 * @param answer - User's input string
 * @returns true if confirmed, false if declined
 *
 * @internal Exported for testing
 */
export function parseConfirmAnswer(answer: string): boolean {
  const trimmed = answer.trim().toLowerCase();
  // Default to true (Yes) if empty, only false if explicitly 'n' or 'no'
  return trimmed !== 'n' && trimmed !== 'no';
}

/**
 * Confirm publish
 */
async function confirmPublish(name: string, version: string, registry: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    // Default is Yes (capital Y), pressing Enter confirms
    rl.question(`\n? Publish ${name}@${version} to ${registry}? (Y/n) `, (answer) => {
      rl.close();
      resolve(parseConfirmAnswer(answer));
    });
  });
}

/**
 * Version input parse result
 */
export interface VersionInputResult {
  valid: boolean;
  version?: string;
  cancelled?: boolean;
  error?: string;
}

/**
 * Parse version input from user
 *
 * @param input - User input string
 * @returns Parse result with version, cancelled flag, or error message
 *
 * @internal Exported for testing
 */
export function parseVersionInput(input: string): VersionInputResult {
  const trimmed = input.trim();

  // Empty input means user wants to cancel
  if (!trimmed) {
    return { valid: false, cancelled: true };
  }

  // Check for v prefix
  if (trimmed.startsWith('v')) {
    return {
      valid: false,
      error: `Invalid version format: "${trimmed}". Version should not have "v" prefix. Use "${trimmed.slice(1)}" instead.`,
    };
  }

  // Validate semver
  if (!semver.valid(trimmed)) {
    return {
      valid: false,
      error: `Invalid version format: "${trimmed}". Must follow semver (e.g., 1.0.0)`,
    };
  }

  return { valid: true, version: trimmed };
}

/**
 * Prompt user for version when missing
 *
 * @returns Version string if user provided one, null if cancelled
 */
async function promptForVersion(): Promise<string | null> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    logger.warn('SKILL.md 中未指定版本号');
    logger.log('  提示：建议在 SKILL.md frontmatter 中添加 version 字段');
    logger.newline();

    const askVersion = (): void => {
      rl.question('? 版本号 (例如 1.0.0，留空取消): ', (answer) => {
        const result = parseVersionInput(answer);

        if (result.cancelled) {
          rl.close();
          resolve(null);
          return;
        }

        if (!result.valid || !result.version) {
          logger.error(result.error || 'Invalid version');
          askVersion(); // Re-prompt
          return;
        }

        rl.close();
        resolve(result.version);
      });
    };

    askVersion();
  });
}

/**
 * Display dry run summary
 */
function displayDryRunSummary(payload: PublishPayload): void {
  logger.newline();
  logger.log(`Integrity: ${payload.integrity}`);
  logger.newline();
  logger.log('No changes made (--dry-run)');
}

// ============================================================================
// Main Action
// ============================================================================

async function publishAction(skillPath: string, options: PublishOptions): Promise<void> {
  const absolutePath = path.resolve(skillPath);
  // Use cwd() as project root to find skills.json, not the skill path
  const registry = resolveRegistry(options.registry, process.cwd());

  // Validate registry is not a blocked public registry
  validateRegistry(registry);

  // Check directory exists
  if (!fs.existsSync(absolutePath)) {
    logger.error(`Directory not found: ${skillPath}`);
    process.exit(1);
  }

  const validator = new SkillValidator();
  const publisher = new Publisher();

  try {
    // 1. Check authentication (skip for dry-run)
    // Note: checkAuth exits the process if not authenticated (unless dry-run)
    checkAuth(registry, options.dryRun || false);

    // 2. Load skill
    const skill = validator.loadSkill(absolutePath);

    // 2.5. Check version - prompt if missing and not in --yes/--dry-run mode
    let userProvidedVersion = false;
    const skillMdVersion =
      skill.skillMd?.version || (skill.skillMd?.metadata?.version as string | undefined);
    if (!skillMdVersion && skill.skillMd) {
      if (options.yes || options.dryRun) {
        // In --yes or --dry-run mode, continue with warning (handled by validator)
        // Skip interactive prompt for non-interactive modes
      } else {
        // Prompt for version
        const userVersion = await promptForVersion();
        if (!userVersion) {
          logger.log('Cancelled. Please add version to SKILL.md frontmatter and try again.');
          return;
        }
        // Set the user-provided version to both skillMd and skillJson
        skill.skillMd.version = userVersion;
        if (skill.skillJson) {
          skill.skillJson.version = userVersion;
        }
        userProvidedVersion = true;
      }
    }

    // 3. Validate
    const validation = validator.validate(absolutePath);

    // 4. Get git info
    let gitInfo: GitInfo;
    try {
      gitInfo = await publisher.getGitInfo(absolutePath, options.tag);
    } catch (error) {
      if (error instanceof PublishError) {
        logger.error(error.message);
        process.exit(1);
      }
      throw error;
    }

    // 5. Generate integrity
    const integrity = validator.generateIntegrity(absolutePath, skill.files);

    // 6. Build payload (only if valid)
    let payload: PublishPayload | null = null;
    if (validation.valid && skill.skillMd && skill.skillJson) {
      // skillJson is synthesized from SKILL.md for backward compatibility with publish API
      payload = publisher.buildPayload(
        {
          path: absolutePath,
          skillJson: skill.skillJson,
          skillMd: skill.skillMd,
          readme: skill.readme,
          files: skill.files,
        },
        gitInfo,
        integrity,
      );
    }

    // 7. Display preview
    // All metadata from SKILL.md
    const displayName = skill.skillMd?.name || 'unknown';
    const displayVersion = skill.skillMd?.version || '0.0.0';

    logger.newline();
    if (options.dryRun) {
      logger.log(`📦 Dry run: ${displayName}@${displayVersion}`);
    } else {
      logger.log(`📦 Publishing ${displayName}@${displayVersion}...`);
    }
    logger.newline();

    displayValidation(skill, validation);

    // Show warnings (skip version warning if user provided it interactively)
    displayWarnings(validation, userProvidedVersion);

    // Show errors and exit if invalid
    if (!validation.valid) {
      displayValidationErrors(validation);
      process.exit(1);
    }

    // Display git info
    displayGitInfo(gitInfo);

    // Display files
    displayFiles(absolutePath, skill.files, publisher);

    // Display metadata
    displayMetadata(skill);

    // 8. Dry run mode ends here
    if (options.dryRun && payload) {
      displayDryRunSummary(payload);
      return;
    }

    // 9. Confirm publish
    if (!options.yes && skill.skillMd) {
      const confirmName = skill.skillMd.name;
      const confirmVersion = skill.skillMd.version || '0.0.0';
      const confirmed = await confirmPublish(confirmName, confirmVersion, registry);
      if (!confirmed) {
        logger.log('Cancelled.');
        return;
      }
    }

    // 10. Get auth token
    const authManager = new AuthManager();
    const token = authManager.getToken(registry);
    if (!token) {
      logger.error('Authentication required');
      logger.newline();
      logger.log('You must be logged in to publish skills.');
      logger.log("Run 'reskill login' to authenticate.");
      process.exit(1);
    }

    // 11. Actually publish
    logger.newline();
    logger.log(`Publishing to ${registry}...`);

    const client = new RegistryClient({ registry, token });

    try {
      // Get skill name from SKILL.md (primary source per agentskills.io spec)
      const name = skill.skillMd?.name;
      if (!name) {
        logger.error('SKILL.md must have a name field in frontmatter');
        process.exit(1);
      }
      const skillName = buildPublishSkillName(name, registry);

      if (!payload) {
        logger.error('Failed to build publish payload');
        process.exit(1);
      }

      const result = await client.publish(skillName, payload, absolutePath, { tag: options.tag });

      if (!result.success || !result.data) {
        logger.error(result.error || 'Publish failed');
        process.exit(1);
      }

      logger.newline();
      logger.log('✓ Published successfully!');
      logger.newline();
      logger.log(`  Name: ${result.data.name}`);
      logger.log(`  Version: ${result.data.version}`);
      logger.log(`  Tag: ${result.data.tag}`);
      logger.log(`  Integrity: ${result.data.integrity}`);
      logger.newline();
      logger.log(`View at: ${registry}/skills/${encodeURIComponent(result.data.name)}`);
    } catch (publishError) {
      if (publishError instanceof RegistryError) {
        logger.error(`Publish failed: ${publishError.message}`);
        if (publishError.statusCode === 409) {
          logger.log('This version already exists. Bump the version in SKILL.md frontmatter.');
        } else if (publishError.statusCode === 403) {
          logger.log('You do not have permission to publish this skill.');
        }
      } else {
        logger.error(`Publish failed: ${(publishError as Error).message}`);
      }
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof PublishError) {
      logger.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

// ============================================================================
// Command Definition
// ============================================================================

export const publishCommand = new Command('publish')
  .alias('pub')
  .description('Publish a skill to the registry')
  .argument('[path]', 'Path to skill directory', '.')
  .option(
    '-r, --registry <url>',
    'Registry URL (or set RESKILL_REGISTRY env var, or defaults.publishRegistry in skills.json)',
  )
  .option('-t, --tag <tag>', 'Git tag to publish')
  .option('--access <level>', 'Access level: public or restricted', 'public')
  .option('-n, --dry-run', 'Validate without publishing')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(publishAction);

export default publishCommand;
