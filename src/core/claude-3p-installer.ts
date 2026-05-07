import * as fs from 'node:fs';
import { homedir, platform as nodePlatform } from 'node:os';
import * as path from 'node:path';
import { parseSkillFromDir } from './skill-parser.js';

export const CLAUDE_COWORK_3P_AGENT = 'claude-cowork-3p';
export const CLAUDE_3P_SKILLS_ROOT_ENV = 'CLAUDE_3P_SKILLS_ROOT';
export const CLAUDE_3P_SKILLS_PLUGIN_BASE_ENV = 'CLAUDE_3P_SKILLS_PLUGIN_BASE';
const DEFAULT_EXCLUDE_FILES = ['README.md', 'metadata.json', '.reskill-commit'];
const EXCLUDE_PREFIX = '_';
const MAX_MANIFEST_BACKUPS = 10;

interface Claude3pManifestSkill {
  skillId: string;
  name: string;
  description: string;
  creatorType: string;
  syncManaged: boolean;
  updatedAt: string;
  enabled: boolean;
  [key: string]: unknown;
}

interface Claude3pManifest {
  skills?: Claude3pManifestSkill[];
  lastUpdated?: number;
  [key: string]: unknown;
}

interface ResolvePathOptions {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  platform?: NodeJS.Platform;
}

interface InstallOptions {
  mode?: 'symlink' | 'copy';
}

interface InstallResult {
  success: boolean;
  path: string;
  canonicalPath?: string;
  mode: 'symlink' | 'copy';
  symlinkFailed?: boolean;
  error?: string;
}

function exists(targetPath: string): boolean {
  return fs.existsSync(targetPath);
}

function ensureDir(dirPath: string): void {
  if (!exists(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function remove(targetPath: string): void {
  if (exists(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function isSafeSkillId(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) && name !== '.' && name !== '..';
}

function isPathSafe(basePath: string, targetPath: string): boolean {
  const normalizedBase = path.normalize(path.resolve(basePath));
  const normalizedTarget = path.normalize(path.resolve(targetPath));

  return normalizedTarget.startsWith(normalizedBase + path.sep);
}

function getSafeSkillPath(root: string, skillName: string): string {
  if (!isSafeSkillId(skillName)) {
    throw new Error(`Skill name is not safe for Claude Cowork 3P: ${skillName}`);
  }

  const skillsDir = path.join(root, 'skills');
  const skillPath = path.join(skillsDir, skillName);
  if (!isPathSafe(skillsDir, skillPath)) {
    throw new Error(`Skill path escapes Claude Cowork 3P skills directory: ${skillName}`);
  }

  return skillPath;
}

function isSkillsRoot(root: string): boolean {
  return exists(path.join(root, 'manifest.json')) && exists(path.join(root, 'skills'));
}

function copyDirectory(src: string, dest: string): void {
  ensureDir(dest);

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (DEFAULT_EXCLUDE_FILES.includes(entry.name) || entry.name.startsWith(EXCLUDE_PREFIX)) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function getClaude3pSkillsPluginBase(options: ResolvePathOptions = {}): string {
  const env = options.env ?? process.env;
  const explicitBase = env[CLAUDE_3P_SKILLS_PLUGIN_BASE_ENV];
  if (explicitBase) {
    return explicitBase;
  }

  const homeDir = options.homeDir ?? homedir();
  const currentPlatform = options.platform ?? nodePlatform();

  if (currentPlatform === 'darwin') {
    return path.join(
      homeDir,
      'Library',
      'Application Support',
      'Claude-3p',
      'local-agent-mode-sessions',
      'skills-plugin',
    );
  }

  if (currentPlatform === 'win32') {
    return path.join(
      env.APPDATA ?? path.join(homeDir, 'AppData', 'Roaming'),
      'Claude-3p',
      'local-agent-mode-sessions',
      'skills-plugin',
    );
  }

  return path.join(
    env.XDG_CONFIG_HOME ?? path.join(homeDir, '.config'),
    'Claude-3p',
    'local-agent-mode-sessions',
    'skills-plugin',
  );
}

export function findClaude3pSkillsRoots(options: ResolvePathOptions = {}): string[] {
  const env = options.env ?? process.env;
  const explicitRoot = env[CLAUDE_3P_SKILLS_ROOT_ENV];

  if (explicitRoot) {
    return isSkillsRoot(explicitRoot) ? [explicitRoot] : [];
  }

  const base = getClaude3pSkillsPluginBase(options);
  if (!exists(base)) {
    return [];
  }

  const roots: string[] = [];
  for (const organization of fs.readdirSync(base, { withFileTypes: true })) {
    if (!organization.isDirectory()) continue;

    const organizationPath = path.join(base, organization.name);
    for (const account of fs.readdirSync(organizationPath, { withFileTypes: true })) {
      if (!account.isDirectory()) continue;

      const candidate = path.join(organizationPath, account.name);
      if (isSkillsRoot(candidate)) {
        roots.push(candidate);
      }
    }
  }

  return roots;
}

export function resolveClaude3pSkillsRoot(options: ResolvePathOptions = {}): string {
  const env = options.env ?? process.env;
  const explicitRoot = env[CLAUDE_3P_SKILLS_ROOT_ENV];

  if (explicitRoot) {
    if (!isSkillsRoot(explicitRoot)) {
      throw new Error(
        `${CLAUDE_3P_SKILLS_ROOT_ENV} must contain manifest.json and skills/: ${explicitRoot}`,
      );
    }
    return explicitRoot;
  }

  const roots = findClaude3pSkillsRoots(options);
  if (roots.length === 1) {
    return roots[0];
  }

  const base = getClaude3pSkillsPluginBase(options);
  if (roots.length === 0) {
    throw new Error(
      `Claude Cowork 3P skills root not found under ${base}. Set ${CLAUDE_3P_SKILLS_ROOT_ENV} to the account directory containing manifest.json and skills/.`,
    );
  }

  throw new Error(
    `Multiple Claude Cowork 3P skills roots found. Set ${CLAUDE_3P_SKILLS_ROOT_ENV} to one of:\n${roots
      .map((root) => `  ${root}`)
      .join('\n')}`,
  );
}

export function getClaude3pSkillPath(skillName: string): string {
  const root = resolveClaude3pSkillsRoot();
  return getSafeSkillPath(root, skillName);
}

function readManifest(manifestPath: string): Claude3pManifest {
  const content = fs.readFileSync(manifestPath, 'utf-8');
  return JSON.parse(content) as Claude3pManifest;
}

function writeManifest(manifestPath: string, manifest: Claude3pManifest): void {
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
}

function createManifestBackup(manifestPath: string): string {
  const backupPath = `${manifestPath}.bak.${Date.now()}`;
  fs.copyFileSync(manifestPath, backupPath);
  return backupPath;
}

function pruneManifestBackups(manifestPath: string): void {
  const manifestDir = path.dirname(manifestPath);
  const backupPrefix = `${path.basename(manifestPath)}.bak.`;
  const backups = fs
    .readdirSync(manifestDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith(backupPrefix))
    .map((entry) => ({
      name: entry.name,
      path: path.join(manifestDir, entry.name),
      mtimeMs: fs.statSync(path.join(manifestDir, entry.name)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const backup of backups.slice(MAX_MANIFEST_BACKUPS)) {
    remove(backup.path);
  }
}

function updateManifest(
  manifestPath: string,
  skillId: string,
  name: string,
  description: string,
): void {
  const manifest = readManifest(manifestPath);
  if (!Array.isArray(manifest.skills)) {
    manifest.skills = [];
  }

  const entry: Claude3pManifestSkill = {
    skillId,
    name,
    description,
    creatorType: 'user',
    syncManaged: false,
    updatedAt: new Date().toISOString(),
    enabled: true,
  };

  const index = manifest.skills.findIndex(
    (skill) => skill.skillId === skillId || skill.name === name,
  );
  if (index >= 0) {
    manifest.skills[index] = { ...manifest.skills[index], ...entry };
  } else {
    manifest.skills.push(entry);
  }

  manifest.lastUpdated = Date.now();
  writeManifest(manifestPath, manifest);
}

function removeFromManifest(manifestPath: string, skillId: string): void {
  const manifest = readManifest(manifestPath);
  if (!Array.isArray(manifest.skills)) {
    return;
  }

  const before = manifest.skills.length;
  manifest.skills = manifest.skills.filter(
    (skill) => skill.skillId !== skillId && skill.name !== skillId,
  );

  if (manifest.skills.length !== before) {
    manifest.lastUpdated = Date.now();
    writeManifest(manifestPath, manifest);
  }
}

export function installClaude3pSkill(
  sourcePath: string,
  fallbackName: string,
  options: InstallOptions = {},
): InstallResult {
  const requestedMode = options.mode ?? 'symlink';
  const installMode = 'copy';
  let manifestPath: string | undefined;
  let manifestBackupPath: string | undefined;
  let targetPath: string | undefined;
  let tmpTarget: string | undefined;
  let rollbackTarget: string | undefined;

  try {
    const metadata = parseSkillFromDir(sourcePath);
    const skillId = metadata?.name ?? fallbackName;
    const description = metadata?.description ?? '';

    if (!isSafeSkillId(skillId)) {
      return {
        success: false,
        path: '',
        mode: installMode,
        error: `SKILL.md name is not safe for Claude Cowork 3P: ${skillId}`,
      };
    }

    const root = resolveClaude3pSkillsRoot();
    manifestPath = path.join(root, 'manifest.json');
    const skillsDir = path.join(root, 'skills');
    targetPath = getSafeSkillPath(root, skillId);
    tmpTarget = path.join(skillsDir, `.${skillId}.installing.${process.pid}`);
    rollbackTarget = path.join(skillsDir, `.${skillId}.rollback.${process.pid}`);
    if (!isPathSafe(skillsDir, tmpTarget)) {
      throw new Error(`Temporary skill path escapes Claude Cowork 3P skills directory: ${skillId}`);
    }
    if (!isPathSafe(skillsDir, rollbackTarget)) {
      throw new Error(`Rollback skill path escapes Claude Cowork 3P skills directory: ${skillId}`);
    }

    manifestBackupPath = createManifestBackup(manifestPath);
    remove(tmpTarget);
    remove(rollbackTarget);
    copyDirectory(sourcePath, tmpTarget);
    if (exists(targetPath)) {
      fs.renameSync(targetPath, rollbackTarget);
    }
    fs.renameSync(tmpTarget, targetPath);

    try {
      updateManifest(manifestPath, skillId, skillId, description);
    } catch (error) {
      remove(targetPath);
      if (rollbackTarget && exists(rollbackTarget)) {
        fs.renameSync(rollbackTarget, targetPath);
      }
      if (manifestBackupPath && manifestPath && exists(manifestBackupPath)) {
        fs.copyFileSync(manifestBackupPath, manifestPath);
      }
      throw error;
    }

    if (rollbackTarget) {
      remove(rollbackTarget);
    }
    pruneManifestBackups(manifestPath);

    return {
      success: true,
      path: targetPath,
      mode: installMode,
    };
  } catch (error) {
    if (tmpTarget) {
      remove(tmpTarget);
    }
    if (targetPath && rollbackTarget && exists(rollbackTarget) && !exists(targetPath)) {
      try {
        fs.renameSync(rollbackTarget, targetPath);
      } catch {
        // Ignore rollback errors while reporting the original installation failure.
      }
    }
    if (manifestPath) {
      try {
        pruneManifestBackups(manifestPath);
      } catch {
        // Ignore cleanup errors while reporting the original installation failure.
      }
    }
    return {
      success: false,
      path: '',
      mode: requestedMode,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function uninstallClaude3pSkill(skillName: string): boolean {
  const root = resolveClaude3pSkillsRoot();
  const targetPath = getSafeSkillPath(root, skillName);
  const manifestPath = path.join(root, 'manifest.json');
  const existed = exists(targetPath);

  if (existed) {
    remove(targetPath);
  }
  removeFromManifest(manifestPath, skillName);

  return existed;
}

export function listClaude3pSkills(): string[] {
  const root = resolveClaude3pSkillsRoot();
  const skillsDir = path.join(root, 'skills');
  if (!exists(skillsDir)) {
    return [];
  }

  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isSafeSkillId(entry.name))
    .map((entry) => entry.name);
}
