/**
 * Integration test helpers
 *
 * Shared utilities for CLI integration tests
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// ============================================================================
// Constants
// ============================================================================

export const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
export const CLI = `node ${path.join(PROJECT_ROOT, 'dist/cli/index.js')}`;

// Test skill from GitHub (small, stable, public)
export const TEST_SKILL_REF = 'github:anthropics/anthropic-quickstarts/skills/computer-use@main';
export const TEST_SKILL_NAME = 'computer-use';

// ============================================================================
// CLI Execution
// ============================================================================

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute CLI command and return result
 *
 * @param args - CLI arguments
 * @param cwd - Working directory (defaults to process.cwd())
 * @param env - Additional environment variables
 */
export function runCli(args: string, cwd?: string, env?: Record<string, string>): CliResult {
  try {
    const stdout = execSync(`${CLI} ${args}`, {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
      timeout: 60000, // 60 second timeout for git operations
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: unknown) {
    const err = error as {
      stdout?: Buffer | string;
      stderr?: Buffer | string;
      status?: number;
      message?: string;
    };
    return {
      stdout: err.stdout?.toString() || '',
      stderr: err.stderr?.toString() || err.message || '',
      exitCode: err.status || 1,
    };
  }
}

/**
 * Get combined output (stdout + stderr) for assertions
 */
export function getOutput(result: CliResult): string {
  return `${result.stdout}\n${result.stderr}`.trim();
}

// ============================================================================
// Temporary Directory Management
// ============================================================================

/**
 * Create a temporary directory for testing
 *
 * @returns Path to the created temporary directory
 */
export function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-integration-'));
}

/**
 * Remove a directory recursively
 *
 * @param dir - Directory path to remove
 */
export function removeTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Create a mock HOME directory for global installation tests
 *
 * @returns Path to the mock home directory
 */
export function createMockHome(): string {
  const mockHome = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-mock-home-'));
  // Create required subdirectories for agent detection
  fs.mkdirSync(path.join(mockHome, '.cursor'), { recursive: true });
  fs.mkdirSync(path.join(mockHome, '.claude'), { recursive: true });
  return mockHome;
}

// ============================================================================
// Local Git Repository Creation
// ============================================================================

/**
 * Create a local git repository with a mock skill
 *
 * This creates a real git repo that can be referenced via file:// protocol
 *
 * @param dir - Parent directory to create the repo in
 * @param name - Repository/skill name
 * @param version - Skill version (default: "1.0.0")
 * @returns Git URL for the repo (file:// protocol)
 */
export function createLocalGitRepo(dir: string, name: string, version = '1.0.0'): string {
  const repoDir = path.join(dir, `${name}-repo`);
  fs.mkdirSync(repoDir, { recursive: true });

  // Create skill files
  fs.writeFileSync(path.join(repoDir, 'skill.json'), JSON.stringify({ name, version }, null, 2));

  // Create SKILL.md with proper frontmatter (per agentskills.io spec)
  fs.writeFileSync(
    path.join(repoDir, 'SKILL.md'),
    `---
name: ${name}
description: A mock skill for testing
version: ${version}
---

# ${name}

A mock skill for testing.

## Usage

This is a test skill version ${version}.
`,
  );

  // Create rules directory with example file
  const rulesDir = path.join(repoDir, 'rules');
  fs.mkdirSync(rulesDir, { recursive: true });
  fs.writeFileSync(
    path.join(rulesDir, 'example.mdc'),
    `---
description: Example rule
globs: ["**/*.ts"]
---

# Example Rule

This is an example rule for testing.
`,
  );

  // Initialize git repository
  execSync('git init', { cwd: repoDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: repoDir, stdio: 'pipe' });
  execSync('git config user.name "Test User"', { cwd: repoDir, stdio: 'pipe' });
  execSync('git add -A', { cwd: repoDir, stdio: 'pipe' });
  execSync(`git commit -m "Initial commit v${version}"`, { cwd: repoDir, stdio: 'pipe' });
  execSync(`git tag v${version}`, { cwd: repoDir, stdio: 'pipe' });

  // Return file:// URL
  return `file://${repoDir}`;
}

/**
 * Create a local git monorepo with a skill where folder name differs from SKILL.md name
 *
 * This creates a monorepo structure where the skill is in a subdirectory
 * and the folder name is different from the name in SKILL.md
 *
 * @param dir - Parent directory to create the repo in
 * @param repoName - Repository name
 * @param folderName - Skill folder name (e.g., "skill")
 * @param skillMdName - Name in SKILL.md (e.g., "agent-aware")
 * @param version - Skill version (default: "1.0.0")
 * @returns Git URL for the repo with subPath (file:// protocol)
 */
export function createLocalMonorepoWithDifferentName(
  dir: string,
  repoName: string,
  folderName: string,
  skillMdName: string,
  version = '1.0.0',
): string {
  const repoDir = path.join(dir, `${repoName}-repo`);
  const skillDir = path.join(repoDir, folderName);
  fs.mkdirSync(skillDir, { recursive: true });

  // Create SKILL.md with skillMdName (different from folder name)
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---
name: ${skillMdName}
description: A mock skill for testing monorepo installation
version: ${version}
---

# ${skillMdName}

A mock skill for testing monorepo installation.

## Usage

This skill folder is named "${folderName}" but SKILL.md name is "${skillMdName}".
`,
  );

  // Create rules directory with example file
  const rulesDir = path.join(skillDir, 'rules');
  fs.mkdirSync(rulesDir, { recursive: true });
  fs.writeFileSync(
    path.join(rulesDir, 'example.mdc'),
    `---
description: Example rule
globs: ["**/*.ts"]
---

# Example Rule

This is an example rule for testing.
`,
  );

  // Initialize git repository
  execSync('git init', { cwd: repoDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: repoDir, stdio: 'pipe' });
  execSync('git config user.name "Test User"', { cwd: repoDir, stdio: 'pipe' });
  execSync('git add -A', { cwd: repoDir, stdio: 'pipe' });
  execSync(`git commit -m "Initial commit v${version}"`, { cwd: repoDir, stdio: 'pipe' });
  execSync(`git tag v${version}`, { cwd: repoDir, stdio: 'pipe' });

  // Return file:// URL with subPath
  return `file://${repoDir}/${folderName}`;
}

/**
 * Create a local git repository containing multiple skills (for --skill integration tests).
 *
 * Structure: repo-root/skills/<name>/SKILL.md
 * Uses file:// protocol; no network required.
 *
 * @param dir - Parent directory to create the repo in
 * @param repoName - Repository directory name
 * @param skills - Array of { name, description } for each skill
 * @param version - Git tag version (default "1.0.0")
 * @returns file:// URL of the repo
 */
export function createLocalMultiSkillRepo(
  dir: string,
  repoName: string,
  skills: Array<{ name: string; description?: string }>,
  version = '1.0.0',
): string {
  const repoDir = path.join(dir, `${repoName}-repo`);
  fs.mkdirSync(repoDir, { recursive: true });

  const skillsDir = path.join(repoDir, 'skills');
  fs.mkdirSync(skillsDir, { recursive: true });

  for (const s of skills) {
    const skillDir = path.join(skillsDir, s.name);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      `---
name: ${s.name}
description: ${s.description ?? `Skill ${s.name}`}
version: ${version}
---

# ${s.name}

A mock skill for testing.
`,
    );
  }

  execSync('git init -b main', { cwd: repoDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: repoDir, stdio: 'pipe' });
  execSync('git config user.name "Test User"', { cwd: repoDir, stdio: 'pipe' });
  execSync('git add -A', { cwd: repoDir, stdio: 'pipe' });
  execSync(`git commit -m "Initial commit v${version}"`, { cwd: repoDir, stdio: 'pipe' });
  execSync(`git tag v${version}`, { cwd: repoDir, stdio: 'pipe' });

  return `file://${repoDir}`;
}

/**
 * Update a local git repo with a new version
 *
 * @param repoUrl - file:// URL of the repo
 * @param newVersion - New version string
 */
export function updateLocalGitRepo(repoUrl: string, newVersion: string): void {
  const repoDir = repoUrl.replace('file://', '');

  // Update skill.json
  const skillJsonPath = path.join(repoDir, 'skill.json');
  const skillJson = JSON.parse(fs.readFileSync(skillJsonPath, 'utf-8'));
  skillJson.version = newVersion;
  fs.writeFileSync(skillJsonPath, JSON.stringify(skillJson, null, 2));

  // Update SKILL.md with proper frontmatter
  const skillMdPath = path.join(repoDir, 'SKILL.md');
  fs.writeFileSync(
    skillMdPath,
    `---
name: ${skillJson.name}
description: A mock skill for testing
version: ${newVersion}
---

# ${skillJson.name}

A mock skill for testing.

## Usage

This is a test skill version ${newVersion}.
`,
  );

  // Commit and tag
  execSync('git add -A', { cwd: repoDir, stdio: 'pipe' });
  execSync(`git commit -m "Update to v${newVersion}"`, { cwd: repoDir, stdio: 'pipe' });
  execSync(`git tag v${newVersion}`, { cwd: repoDir, stdio: 'pipe' });
}

// ============================================================================
// Mock Skill Creation (for manual directory setup)
// ============================================================================

/**
 * Create a mock skill directory for testing (without git)
 *
 * Use this for tests that manually set up skill directories
 *
 * @param dir - Parent directory to create the skill in
 * @param name - Skill name
 * @param version - Skill version (default: "1.0.0")
 * @returns Path to the created skill directory
 */
export function createMockSkill(dir: string, name: string, version = '1.0.0'): string {
  const skillDir = path.join(dir, name);
  fs.mkdirSync(skillDir, { recursive: true });

  // Create skill.json
  fs.writeFileSync(path.join(skillDir, 'skill.json'), JSON.stringify({ name, version }, null, 2));

  // Create SKILL.md with proper frontmatter (per agentskills.io spec)
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---
name: ${name}
description: A mock skill for testing
version: ${version}
---

# ${name}

A mock skill for testing.

## Usage

This is a test skill version ${version}.
`,
  );

  // Create rules directory with example file
  const rulesDir = path.join(skillDir, 'rules');
  fs.mkdirSync(rulesDir, { recursive: true });
  fs.writeFileSync(
    path.join(rulesDir, 'example.mdc'),
    `---
description: Example rule
globs: ["**/*.ts"]
---

# Example Rule

This is an example rule for testing.
`,
  );

  return skillDir;
}

/**
 * Update a mock skill to a new version
 *
 * @param skillDir - Path to the skill directory
 * @param newVersion - New version string
 */
export function updateMockSkillVersion(skillDir: string, newVersion: string): void {
  const skillJsonPath = path.join(skillDir, 'skill.json');
  const skillJson = JSON.parse(fs.readFileSync(skillJsonPath, 'utf-8'));
  skillJson.version = newVersion;
  fs.writeFileSync(skillJsonPath, JSON.stringify(skillJson, null, 2));
}

// ============================================================================
// Configuration Helpers
// ============================================================================

/**
 * Create a skills.json configuration file
 *
 * @param dir - Directory to create the file in
 * @param skills - Skills to include in the configuration
 * @param defaults - Default options
 * @param registries - Custom registry configuration
 */
export function setupSkillsJson(
  dir: string,
  skills: Record<string, string> = {},
  defaults: {
    installDir?: string;
    installMode?: 'symlink' | 'copy';
    targetAgents?: string[];
  } = {},
  registries?: Record<string, string>,
): void {
  const config: Record<string, unknown> = {
    skills,
    defaults: {
      installDir: defaults.installDir || '.skills',
      ...(defaults.installMode && { installMode: defaults.installMode }),
      ...(defaults.targetAgents && { targetAgents: defaults.targetAgents }),
    },
  };
  if (registries) {
    config.registries = registries;
  }
  fs.writeFileSync(path.join(dir, 'skills.json'), JSON.stringify(config, null, 2));
}

/**
 * Read skills.json configuration
 *
 * @param dir - Directory containing skills.json
 * @returns Parsed configuration object
 */
export function readSkillsJson(dir: string): {
  skills: Record<string, string>;
  defaults: Record<string, unknown>;
} {
  const configPath = path.join(dir, 'skills.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Check if a path is a symbolic link
 *
 * @param linkPath - Path to check
 * @returns true if path is a symlink
 */
export function isSymlink(linkPath: string): boolean {
  try {
    const stats = fs.lstatSync(linkPath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Check if a path exists (file or directory)
 *
 * @param targetPath - Path to check
 * @returns true if path exists
 */
export function pathExists(targetPath: string): boolean {
  return fs.existsSync(targetPath);
}

/**
 * Read file contents
 *
 * @param filePath - Path to file
 * @returns File contents as string
 */
export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Get symlink target
 *
 * @param linkPath - Path to symlink
 * @returns Resolved target path
 */
export function getSymlinkTarget(linkPath: string): string {
  return fs.readlinkSync(linkPath);
}
