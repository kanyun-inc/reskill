import { execSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { Command } from 'commander';
import { detectInstalledAgents, isValidAgentType } from '../../core/agent-registry.js';
import { AuthManager } from '../../core/auth-manager.js';
import { ConfigLoader, DEFAULT_REGISTRIES } from '../../core/config-loader.js';
import { GitResolver } from '../../core/git-resolver.js';
import { HttpResolver } from '../../core/http-resolver.js';
import { LOCKFILE_VERSION, LockManager } from '../../core/lock-manager.js';
import { SkillManager } from '../../core/skill-manager.js';
import { logger } from '../../utils/logger.js';
import { checkForUpdate } from '../../utils/update-notifier.js';

/**
 * Check result type
 */
export type CheckStatus = 'ok' | 'warn' | 'error';

export interface CheckResult {
  name: string;
  status: CheckStatus;
  message: string;
  hint?: string;
}

/**
 * Get status icon
 */
export function getStatusIcon(status: CheckStatus): string {
  switch (status) {
    case 'ok':
      return chalk.green('✓');
    case 'warn':
      return chalk.yellow('⚠');
    case 'error':
      return chalk.red('✗');
  }
}

/**
 * Execute command and return output
 *
 * @warning This function executes arbitrary shell commands. It is exported for
 * testing purposes only. Do not use with untrusted input. Internal usage is
 * limited to hardcoded commands (e.g., 'git --version').
 */
export function execCommand(command: string): string | null {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

/**
 * Get directory size in bytes
 */
export function getDirSize(dirPath: string): number {
  if (!existsSync(dirPath)) return 0;

  let size = 0;
  try {
    const items = readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
      const itemPath = join(dirPath, item.name);
      if (item.isDirectory()) {
        size += getDirSize(itemPath);
      } else if (item.isFile()) {
        size += statSync(itemPath).size;
      }
    }
  } catch {
    // Ignore permission errors
  }
  return size;
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

/**
 * Count cached skills
 */
export function countCachedSkills(cacheDir: string): number {
  if (!existsSync(cacheDir)) return 0;

  let count = 0;
  try {
    // Cache structure: ~/.reskill-cache/<registry>/<owner>/<repo>/<version>/
    const registries = readdirSync(cacheDir, { withFileTypes: true });
    for (const registry of registries) {
      if (!registry.isDirectory()) continue;
      const registryPath = join(cacheDir, registry.name);
      const owners = readdirSync(registryPath, { withFileTypes: true });
      for (const owner of owners) {
        if (!owner.isDirectory()) continue;
        const ownerPath = join(registryPath, owner.name);
        const repos = readdirSync(ownerPath, { withFileTypes: true });
        for (const repo of repos) {
          if (!repo.isDirectory()) continue;
          const repoPath = join(ownerPath, repo.name);
          const versions = readdirSync(repoPath, { withFileTypes: true });
          count += versions.filter((v) => v.isDirectory()).length;
        }
      }
    }
  } catch {
    // Ignore errors
  }
  return count;
}

/**
 * Check reskill version
 */
export async function checkReskillVersion(
  currentVersion: string,
  packageName: string,
): Promise<CheckResult> {
  try {
    const result = await checkForUpdate(packageName, currentVersion);
    if (result?.hasUpdate) {
      return {
        name: 'reskill version',
        status: 'warn',
        message: `${currentVersion} (latest: ${result.latest})`,
        hint: `Run: npm i -g ${packageName}@latest`,
      };
    }
    return {
      name: 'reskill version',
      status: 'ok',
      message: `${currentVersion} (latest)`,
    };
  } catch {
    return {
      name: 'reskill version',
      status: 'ok',
      message: currentVersion,
    };
  }
}

/**
 * Check Node.js version
 */
export function checkNodeVersion(): CheckResult {
  const version = process.version;
  const major = Number.parseInt(version.slice(1).split('.')[0], 10);
  const required = 18;

  if (major < required) {
    return {
      name: 'Node.js version',
      status: 'error',
      message: `${version} (requires >=${required}.0.0)`,
      hint: 'Please upgrade Node.js to version 18 or higher',
    };
  }

  return {
    name: 'Node.js version',
    status: 'ok',
    message: `${version} (>=${required}.0.0 required)`,
  };
}

/**
 * Check Git version
 */
export function checkGitVersion(): CheckResult {
  const version = execCommand('git --version');

  if (!version) {
    return {
      name: 'Git',
      status: 'error',
      message: 'not found',
      hint: 'Please install Git: https://git-scm.com/downloads',
    };
  }

  // Extract version number from "git version X.Y.Z"
  const match = version.match(/git version (\d+\.\d+\.\d+)/);
  const versionNum = match ? match[1] : version;

  return {
    name: 'Git',
    status: 'ok',
    message: versionNum,
  };
}

/**
 * Check Git authentication
 */
export function checkGitAuth(): CheckResult {
  const home = homedir();
  const sshDir = join(home, '.ssh');

  // Check for SSH keys
  const sshKeyFiles = ['id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'];
  let hasSSHKey = false;

  if (existsSync(sshDir)) {
    for (const keyFile of sshKeyFiles) {
      if (existsSync(join(sshDir, keyFile))) {
        hasSSHKey = true;
        break;
      }
    }
  }

  // Check for git credential helper
  const credentialHelper = execCommand('git config --global credential.helper');
  const hasCredentialHelper = !!credentialHelper;

  if (hasSSHKey && hasCredentialHelper) {
    return {
      name: 'Git authentication',
      status: 'ok',
      message: 'SSH key + credential helper configured',
    };
  }
  if (hasSSHKey) {
    return {
      name: 'Git authentication',
      status: 'ok',
      message: 'SSH key found',
    };
  }
  if (hasCredentialHelper) {
    return {
      name: 'Git authentication',
      status: 'ok',
      message: `credential helper: ${credentialHelper}`,
    };
  }

  return {
    name: 'Git authentication',
    status: 'warn',
    message: 'no SSH key or credential helper found',
    hint: 'For private repos, add SSH key: ssh-keygen -t ed25519',
  };
}

/**
 * Valid install modes
 *
 * Must stay in sync with InstallMode type from installer.ts ('symlink' | 'copy').
 * TypeScript literal union types are erased at runtime, so we maintain this list manually.
 */
const VALID_INSTALL_MODES = ['symlink', 'copy'];

/**
 * Check registry authentication status
 *
 * Verifies actual token availability, not just file existence.
 * Uses AuthManager.getToken() which checks RESKILL_TOKEN env first,
 * then reads ~/.reskillrc for the configured registry.
 */
export function checkAuthStatus(): CheckResult {
  const hasEnvToken = !!process.env.RESKILL_TOKEN;

  if (hasEnvToken) {
    return {
      name: 'Registry auth',
      status: 'ok',
      message: 'RESKILL_TOKEN set',
    };
  }

  // Check if ~/.reskillrc has any valid tokens
  const authManager = new AuthManager();
  const configPath = authManager.getConfigPath();

  if (!existsSync(configPath)) {
    return {
      name: 'Registry auth',
      status: 'warn',
      message: 'no token configured',
      hint: 'Run: reskill login (needed for publish and private skills)',
    };
  }

  // File exists — check if it actually contains a token for any registry
  const hasToken = authManager.hasToken();
  if (hasToken) {
    return {
      name: 'Registry auth',
      status: 'ok',
      message: 'token configured via ~/.reskillrc',
    };
  }

  return {
    name: 'Registry auth',
    status: 'warn',
    message: '~/.reskillrc exists but no token found for current registry',
    hint: 'Run: reskill login (needed for publish and private skills)',
  };
}

/**
 * Check environment variables used by reskill
 *
 * Security: Only report variable names, never values.
 * RESKILL_TOKEN contains a secret and must not be displayed.
 */
export function checkEnvVars(): CheckResult {
  // Only collect names, never values (RESKILL_TOKEN is a secret)
  const vars: string[] = [];

  if (process.env.RESKILL_TOKEN) {
    vars.push('RESKILL_TOKEN');
  }
  if (process.env.RESKILL_REGISTRY) {
    vars.push('RESKILL_REGISTRY');
  }
  if (process.env.RESKILL_CACHE_DIR) {
    vars.push('RESKILL_CACHE_DIR');
  }

  if (vars.length === 0) {
    return {
      name: 'Environment vars',
      status: 'ok',
      message: 'none set',
    };
  }

  return {
    name: 'Environment vars',
    status: 'ok',
    message: `${vars.join(', ')} set`,
  };
}

/**
 * Check cache directory
 */
export function checkCacheDir(): CheckResult {
  const cacheDir = process.env.RESKILL_CACHE_DIR || join(homedir(), '.reskill-cache');

  if (!existsSync(cacheDir)) {
    return {
      name: 'Cache directory',
      status: 'ok',
      message: `${cacheDir} (not created yet)`,
    };
  }

  const size = getDirSize(cacheDir);
  const count = countCachedSkills(cacheDir);

  return {
    name: 'Cache directory',
    status: 'ok',
    message: `${cacheDir} (${formatBytes(size)}, ${count} skill${count !== 1 ? 's' : ''} cached)`,
  };
}

/**
 * Check skills.json
 */
export function checkSkillsJson(cwd: string): CheckResult {
  const configLoader = new ConfigLoader(cwd);

  if (!configLoader.exists()) {
    return {
      name: 'skills.json',
      status: 'warn',
      message: 'not found',
      hint: 'Run: reskill init',
    };
  }

  try {
    const skills = configLoader.getSkills();
    const count = Object.keys(skills).length;
    return {
      name: 'skills.json',
      status: 'ok',
      message: `found (${count} skill${count !== 1 ? 's' : ''} declared)`,
    };
  } catch (error) {
    return {
      name: 'skills.json',
      status: 'error',
      message: `invalid format: ${(error as Error).message}`,
      hint: 'Check skills.json syntax',
    };
  }
}

/**
 * Reserved registry names that should not be overridden
 */
const RESERVED_REGISTRIES = ['github', 'gitlab'];

/**
 * Dangerous paths that should not be used as installDir
 */
const DANGEROUS_INSTALL_DIRS = [
  'src',
  'lib',
  'dist',
  'build',
  'out',
  'node_modules',
  '.git',
  '.github',
  '.gitlab',
  '.vscode',
  '.idea',
];

/**
 * Dangerous skill name patterns
 */
const DANGEROUS_SKILL_NAMES = ['.git', '..', '.', 'node_modules', '__proto__', 'constructor'];

/**
 * Network connectivity check timeout in milliseconds
 */
const NETWORK_CHECK_TIMEOUT_MS = 5000;

/**
 * Padding width for check result names in output.
 * Accounts for nested items with "  └─ " prefix (5 chars).
 */
const CHECK_NAME_PAD_WIDTH = 26;

/**
 * Check for registry name conflicts
 */
export function checkRegistryConflicts(cwd: string): CheckResult[] {
  const results: CheckResult[] = [];
  const configLoader = new ConfigLoader(cwd);

  if (!configLoader.exists()) {
    return results;
  }

  try {
    const config = configLoader.load();
    const registries = config.registries || {};

    for (const [name, url] of Object.entries(registries)) {
      if (RESERVED_REGISTRIES.includes(name.toLowerCase())) {
        results.push({
          name: 'Registry conflict',
          status: 'warn',
          message: `"${name}" overrides built-in registry`,
          hint: 'Consider using a different name for custom registries',
        });
      }

      // Validate URL format
      if (typeof url === 'string' && !/^https?:\/\//.test(url)) {
        results.push({
          name: 'Invalid registry URL',
          status: 'error',
          message: `"${name}": "${url}" is not a valid URL`,
          hint: 'Registry URLs must start with http:// or https://',
        });
      }
    }
  } catch {
    // Ignore parse errors, handled by checkSkillsJson
  }

  return results;
}

/**
 * Check for dangerous installDir configuration
 */
export function checkInstallDir(cwd: string): CheckResult | null {
  const configLoader = new ConfigLoader(cwd);

  if (!configLoader.exists()) {
    return null;
  }

  try {
    const defaults = configLoader.getDefaults();
    const installDir = defaults.installDir;

    if (!installDir) {
      return null;
    }

    // Check for dangerous paths
    const normalizedDir = installDir.replace(/^\.\//, '').replace(/\/$/, '');
    if (DANGEROUS_INSTALL_DIRS.includes(normalizedDir.toLowerCase())) {
      return {
        name: 'Dangerous installDir',
        status: 'error',
        message: `"${installDir}" may conflict with important directories`,
        hint: 'Use a dedicated directory like ".skills" or ".agents/skills"',
      };
    }

    // Check for path traversal
    if (installDir.includes('..')) {
      return {
        name: 'Dangerous installDir',
        status: 'error',
        message: `"${installDir}" contains path traversal`,
        hint: 'Use a simple directory name without ".."',
      };
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}

/**
 * Check for invalid installMode configuration
 */
export function checkInstallMode(cwd: string): CheckResult | null {
  const configLoader = new ConfigLoader(cwd);

  if (!configLoader.exists()) {
    return null;
  }

  try {
    const defaults = configLoader.getDefaults();
    const installMode = defaults.installMode;

    if (!installMode) {
      return null;
    }

    if (!VALID_INSTALL_MODES.includes(installMode)) {
      return {
        name: 'Invalid installMode',
        status: 'error',
        message: `"${installMode}" is not a valid install mode`,
        hint: 'Valid values: symlink, copy',
      };
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}

/**
 * Check for invalid publishRegistry configuration
 */
export function checkPublishRegistry(cwd: string): CheckResult | null {
  const configLoader = new ConfigLoader(cwd);

  if (!configLoader.exists()) {
    return null;
  }

  try {
    const defaults = configLoader.getDefaults();
    const publishRegistry = defaults.publishRegistry;

    if (!publishRegistry) {
      return null;
    }

    if (!/^https?:\/\//.test(publishRegistry)) {
      return {
        name: 'Invalid publishRegistry',
        status: 'warn',
        message: `"${publishRegistry}" is not a valid URL`,
        hint: 'publishRegistry must start with http:// or https://',
      };
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}

/**
 * Check for invalid targetAgents configuration
 */
export function checkTargetAgents(cwd: string): CheckResult[] {
  const results: CheckResult[] = [];
  const configLoader = new ConfigLoader(cwd);

  if (!configLoader.exists()) {
    return results;
  }

  try {
    const defaults = configLoader.getDefaults();
    const targetAgents = defaults.targetAgents || [];

    for (const agent of targetAgents) {
      if (!isValidAgentType(agent)) {
        results.push({
          name: 'Invalid agent',
          status: 'warn',
          message: `Unknown agent type: "${agent}"`,
          hint: 'Run: reskill install --help to see valid agent types',
        });
      }
    }
  } catch {
    // Ignore parse errors
  }

  return results;
}

/**
 * Check for skill reference format errors
 */
export function checkSkillRefs(cwd: string): CheckResult[] {
  const results: CheckResult[] = [];
  const configLoader = new ConfigLoader(cwd);

  if (!configLoader.exists()) {
    return results;
  }

  try {
    const skills = configLoader.getSkills();
    const gitResolver = new GitResolver();
    const httpResolver = new HttpResolver();

    for (const [name, ref] of Object.entries(skills)) {
      // Check for dangerous skill names
      if (DANGEROUS_SKILL_NAMES.includes(name) || name.includes('/') || name.includes('\\')) {
        results.push({
          name: 'Dangerous skill name',
          status: 'error',
          message: `"${name}" is not a valid skill name`,
          hint: 'Use alphanumeric names with hyphens or underscores',
        });
        continue;
      }

      // Try to parse the reference based on its type
      const isHttp = HttpResolver.isHttpUrl(ref);
      try {
        if (isHttp) {
          // Validate HTTP/OSS/S3 URL
          httpResolver.parseRef(ref);
        } else {
          // Validate Git reference
          gitResolver.parseRef(ref);
        }
      } catch (error) {
        const hint = isHttp
          ? 'Format: https://host/path/skill.tar.gz or oss://bucket/path/skill.tar.gz'
          : 'Format: registry:owner/repo@version or owner/repo@version';
        results.push({
          name: 'Invalid skill ref',
          status: 'error',
          message: `"${name}": ${(error as Error).message}`,
          hint,
        });
      }
    }
  } catch {
    // Ignore parse errors
  }

  return results;
}

/**
 * Check for version conflicts in monorepo skills
 */
export function checkMonorepoVersions(cwd: string): CheckResult[] {
  const results: CheckResult[] = [];
  const configLoader = new ConfigLoader(cwd);

  if (!configLoader.exists()) {
    return results;
  }

  try {
    const skills = configLoader.getSkills();
    const gitResolver = new GitResolver();
    const repoVersions = new Map<string, Map<string, string[]>>();

    for (const [name, ref] of Object.entries(skills)) {
      try {
        // Skip HTTP sources (no monorepo support)
        if (HttpResolver.isHttpUrl(ref)) {
          continue;
        }

        const parsed = gitResolver.parseRef(ref);

        // Only check skills with subPath (monorepo)
        if (!parsed.subPath) {
          continue;
        }

        const repoKey = `${parsed.registry}:${parsed.owner}/${parsed.repo}`;
        const version = parsed.version || 'default';

        let versions = repoVersions.get(repoKey);
        if (!versions) {
          versions = new Map();
          repoVersions.set(repoKey, versions);
        }

        let skillList = versions.get(version);
        if (!skillList) {
          skillList = [];
          versions.set(version, skillList);
        }
        skillList.push(name);
      } catch {
        // Skip invalid refs, handled by checkSkillRefs
      }
    }

    // Check for multiple versions from same repo
    for (const [repo, versions] of repoVersions) {
      if (versions.size > 1) {
        const versionList = [...versions.entries()]
          .map(([v, skills]) => `${v} (${skills.join(', ')})`)
          .join(', ');
        results.push({
          name: 'Version mismatch',
          status: 'warn',
          message: `${repo} has multiple versions: ${versionList}`,
          hint: 'Consider using the same version for all skills from this repo',
        });
      }
    }
  } catch {
    // Ignore parse errors
  }

  return results;
}

/**
 * Check skills.lock sync status
 */
export function checkSkillsLock(cwd: string): CheckResult {
  const configLoader = new ConfigLoader(cwd);
  const lockManager = new LockManager(cwd);

  if (!configLoader.exists()) {
    return {
      name: 'skills.lock',
      status: 'ok',
      message: 'n/a (no skills.json)',
    };
  }

  if (!lockManager.exists()) {
    const skills = configLoader.getSkills();
    if (Object.keys(skills).length === 0) {
      return {
        name: 'skills.lock',
        status: 'ok',
        message: 'n/a (no skills declared)',
      };
    }
    return {
      name: 'skills.lock',
      status: 'warn',
      message: 'not found',
      hint: 'Run: reskill install',
    };
  }

  // Check lockfile version compatibility before sync check
  // If version is unsupported, sync results would be meaningless
  const lockData = lockManager.load();
  if (lockData.lockfileVersion !== LOCKFILE_VERSION) {
    return {
      name: 'skills.lock',
      status: 'warn',
      message: `unsupported lockfile version: ${lockData.lockfileVersion}`,
      hint: 'Run: reskill install to regenerate',
    };
  }

  // Check if lock is in sync with config
  const configSkills = configLoader.getSkills();
  const lockedSkills = lockManager.getAll();

  const configNames = new Set(Object.keys(configSkills));
  const lockedNames = new Set(Object.keys(lockedSkills));

  const missingInLock = [...configNames].filter((n) => !lockedNames.has(n));
  const extraInLock = [...lockedNames].filter((n) => !configNames.has(n));

  if (missingInLock.length > 0) {
    const displayMissing =
      missingInLock.length > 3
        ? `${missingInLock.slice(0, 3).join(', ')} +${missingInLock.length - 3} more`
        : missingInLock.join(', ');
    return {
      name: 'skills.lock',
      status: 'warn',
      message: `out of sync (missing: ${displayMissing})`,
      hint: 'Run: reskill install',
    };
  }

  if (extraInLock.length > 0) {
    const displayExtra =
      extraInLock.length > 3
        ? `${extraInLock.slice(0, 3).join(', ')} +${extraInLock.length - 3} more`
        : extraInLock.join(', ');
    return {
      name: 'skills.lock',
      status: 'warn',
      message: `out of sync (extra: ${displayExtra})`,
      hint: 'Run: reskill install',
    };
  }

  return {
    name: 'skills.lock',
    status: 'ok',
    message: `in sync (${lockedNames.size} skill${lockedNames.size !== 1 ? 's' : ''} locked)`,
  };
}

/**
 * Skill issue type
 */
export interface SkillIssue {
  name: string;
  reason: string;
  severity: 'error' | 'warn';
}

/**
 * Check if a file is a valid symlink
 */
function isValidSymlink(path: string): boolean {
  try {
    const stat = lstatSync(path);
    if (!stat.isSymbolicLink()) {
      return true; // Not a symlink, so not a broken symlink
    }
    // Try to resolve the symlink target
    realpathSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check installed skills with detailed diagnostics
 *
 * Only checks for SKILL.md since that's the sole source of metadata
 */
export function checkInstalledSkills(cwd: string): CheckResult[] {
  const results: CheckResult[] = [];
  const skillManager = new SkillManager(cwd);
  const installed = skillManager.list();

  if (installed.length === 0) {
    return [
      {
        name: 'Installed skills',
        status: 'ok',
        message: 'none',
      },
    ];
  }

  // Check each installed skill for issues
  const issues: SkillIssue[] = [];

  for (const skill of installed) {
    const skillMdPath = join(skill.path, 'SKILL.md');

    // Check for broken symlink
    if (skill.isLinked && !isValidSymlink(skill.path)) {
      issues.push({
        name: skill.name,
        reason: 'symlink target does not exist',
        severity: 'error',
      });
      continue;
    }

    // Check for missing SKILL.md (required per agentskills.io spec)
    const hasSkillMd = existsSync(skillMdPath);

    if (!hasSkillMd) {
      issues.push({
        name: skill.name,
        reason: 'missing SKILL.md',
        severity: 'error',
      });
    }
  }

  // Build summary result
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warnCount = issues.filter((i) => i.severity === 'warn').length;

  if (issues.length === 0) {
    results.push({
      name: 'Installed skills',
      status: 'ok',
      message: `${installed.length} skill${installed.length !== 1 ? 's' : ''} installed`,
    });
  } else {
    const status: CheckStatus = errorCount > 0 ? 'error' : 'warn';
    const issueText = errorCount > 0 ? `${errorCount} broken` : `${warnCount} with issues`;

    results.push({
      name: 'Installed skills',
      status,
      message: `${installed.length} installed, ${issueText}`,
      hint: 'Run: reskill install --force to fix',
    });

    // Add detailed issues
    for (const issue of issues) {
      results.push({
        name: `  └─ ${issue.name}`,
        status: issue.severity === 'error' ? 'error' : 'warn',
        message: issue.reason,
      });
    }
  }

  return results;
}

/**
 * Check detected agents
 */
export async function checkDetectedAgents(): Promise<CheckResult> {
  try {
    const installed = await detectInstalledAgents();

    if (installed.length === 0) {
      return {
        name: 'Detected agents',
        status: 'ok',
        message: 'none detected',
      };
    }

    return {
      name: 'Detected agents',
      status: 'ok',
      message: `${installed.length} detected: ${installed.join(', ')}`,
    };
  } catch {
    return {
      name: 'Detected agents',
      status: 'warn',
      message: 'detection failed',
    };
  }
}

/**
 * Normalize a URL to its origin for comparison.
 * Handles trailing slashes and case differences (e.g., GITHUB.COM → github.com).
 */
function normalizeUrlOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/**
 * Get custom registry URLs for network checks
 *
 * Reads registries from skills.json and publishRegistry,
 * excluding built-in github.com/gitlab.com and deduplicating.
 */
export function getCustomRegistryUrls(cwd: string): string[] {
  const urls = new Set<string>();
  const builtinOrigins = new Set(
    Object.values(DEFAULT_REGISTRIES).map((u) => normalizeUrlOrigin(u)),
  );

  try {
    const configLoader = new ConfigLoader(cwd);
    if (!configLoader.exists()) {
      return [];
    }

    // Collect custom registry URLs
    const config = configLoader.load();
    const registries = config.registries || {};
    for (const url of Object.values(registries)) {
      if (
        typeof url === 'string' &&
        /^https?:\/\//.test(url) &&
        !builtinOrigins.has(normalizeUrlOrigin(url))
      ) {
        urls.add(url);
      }
    }

    // Collect publishRegistry
    const defaults = configLoader.getDefaults();
    if (defaults.publishRegistry && /^https?:\/\//.test(defaults.publishRegistry)) {
      if (!builtinOrigins.has(normalizeUrlOrigin(defaults.publishRegistry))) {
        urls.add(defaults.publishRegistry);
      }
    }
  } catch {
    // Ignore errors
  }

  return [...urls];
}

/**
 * Check network connectivity
 */
export async function checkNetwork(host: string): Promise<CheckResult> {
  const displayName = host.replace('https://', '').replace('http://', '');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NETWORK_CHECK_TIMEOUT_MS);

    const response = await fetch(host, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok || response.status === 301 || response.status === 302) {
      return {
        name: `Network (${displayName})`,
        status: 'ok',
        message: 'reachable',
      };
    }

    return {
      name: `Network (${displayName})`,
      status: 'warn',
      message: `status ${response.status}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'unknown error';
    return {
      name: `Network (${displayName})`,
      status: 'error',
      message: `unreachable (${errorMessage})`,
      hint: 'Check your internet connection or firewall settings',
    };
  }
}

/**
 * Print check result
 */
export function printResult(result: CheckResult): void {
  const icon = getStatusIcon(result.status);
  const name = result.name.padEnd(CHECK_NAME_PAD_WIDTH);
  const message = result.status === 'ok' ? result.message : chalk.dim(result.message);

  logger.log(`${icon} ${name} ${message}`);

  if (result.hint) {
    logger.log(`  ${chalk.dim('→')} ${chalk.dim(result.hint)}`);
  }
}

/**
 * Run all checks
 */
export async function runDoctorChecks(options: {
  cwd: string;
  packageName: string;
  packageVersion: string;
  skipNetwork?: boolean;
  skipConfigChecks?: boolean;
}): Promise<CheckResult[]> {
  const { cwd, packageName, packageVersion, skipNetwork, skipConfigChecks } = options;
  const results: CheckResult[] = [];

  // Environment checks
  results.push(await checkReskillVersion(packageVersion, packageName));
  results.push(checkNodeVersion());
  results.push(checkGitVersion());
  results.push(checkGitAuth());
  results.push(checkAuthStatus());
  results.push(checkEnvVars());

  // Directory checks
  results.push(checkCacheDir());
  results.push(checkSkillsJson(cwd));
  results.push(checkSkillsLock(cwd));
  results.push(...checkInstalledSkills(cwd));
  results.push(await checkDetectedAgents());

  // Deep config checks (can be skipped for faster checks)
  if (!skipConfigChecks) {
    // Registry conflicts + URL validation
    results.push(...checkRegistryConflicts(cwd));

    // installDir validation
    const installDirCheck = checkInstallDir(cwd);
    if (installDirCheck) {
      results.push(installDirCheck);
    }

    // installMode validation
    const installModeCheck = checkInstallMode(cwd);
    if (installModeCheck) {
      results.push(installModeCheck);
    }

    // publishRegistry validation
    const publishRegistryCheck = checkPublishRegistry(cwd);
    if (publishRegistryCheck) {
      results.push(publishRegistryCheck);
    }

    // targetAgents validation
    results.push(...checkTargetAgents(cwd));

    // Skill reference format validation
    results.push(...checkSkillRefs(cwd));

    // Monorepo version consistency
    results.push(...checkMonorepoVersions(cwd));
  }

  // Network checks
  if (!skipNetwork) {
    results.push(await checkNetwork('https://github.com'));
    results.push(await checkNetwork('https://gitlab.com'));

    // Custom registry connectivity
    const customUrls = getCustomRegistryUrls(cwd);
    for (const url of customUrls) {
      results.push(await checkNetwork(url));
    }
  }

  return results;
}

/**
 * doctor command - Diagnose reskill environment
 */
export const doctorCommand = new Command('doctor')
  .description('Diagnose reskill environment and check for issues')
  .option('--json', 'Output as JSON')
  .option('--skip-network', 'Skip network connectivity checks')
  .action(async (options) => {
    // Get package info
    const __dirname = dirname(fileURLToPath(import.meta.url));
    // In bundled output, __dirname is dist/cli/, so ../../package.json
    const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

    if (!options.json) {
      logger.log(chalk.bold('\n🩺 Checking reskill environment...\n'));
    }

    const results = await runDoctorChecks({
      cwd: process.cwd(),
      packageName: packageJson.name,
      packageVersion: packageJson.version,
      skipNetwork: options.skipNetwork,
    });

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    // Print results
    for (const result of results) {
      printResult(result);
    }

    // Summary
    const errors = results.filter((r) => r.status === 'error').length;
    const warnings = results.filter((r) => r.status === 'warn').length;

    logger.newline();

    if (errors > 0) {
      logger.error(
        `Found ${errors} error${errors !== 1 ? 's' : ''} and ${warnings} warning${warnings !== 1 ? 's' : ''}`,
      );
      process.exit(1);
    }
    if (warnings > 0) {
      logger.warn(`Found ${warnings} warning${warnings !== 1 ? 's' : ''}, but reskill should work`);
    } else {
      logger.success('All checks passed! reskill is ready to use.');
    }
  });

export default doctorCommand;
