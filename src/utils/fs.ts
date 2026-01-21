import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * File system utilities
 */

/**
 * Check if a file or directory exists
 */
export function exists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Read JSON file
 */
export function readJson<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Write JSON file
 */
export function writeJson<T>(filePath: string, data: T, indent = 2): void {
  const dir = path.dirname(filePath);
  if (!exists(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, indent) + '\n', 'utf-8');
}

/**
 * Read text file
 */
export function readText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Write text file
 */
export function writeText(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!exists(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Create directory recursively
 */
export function ensureDir(dirPath: string): void {
  if (!exists(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Remove file or directory
 */
export function remove(targetPath: string): void {
  if (exists(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

/**
 * Copy directory recursively
 */
export function copyDir(src: string, dest: string, options?: { exclude?: string[] }): void {
  const exclude = options?.exclude || [];
  
  ensureDir(dest);
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    if (exclude.includes(entry.name)) {
      continue;
    }
    
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, options);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * List directory contents
 */
export function listDir(dirPath: string): string[] {
  if (!exists(dirPath)) {
    return [];
  }
  return fs.readdirSync(dirPath);
}

/**
 * Check if path is a directory
 */
export function isDirectory(targetPath: string): boolean {
  if (!exists(targetPath)) {
    return false;
  }
  return fs.statSync(targetPath).isDirectory();
}

/**
 * Check if path is a symbolic link
 */
export function isSymlink(targetPath: string): boolean {
  if (!exists(targetPath)) {
    return false;
  }
  return fs.lstatSync(targetPath).isSymbolicLink();
}

/**
 * Create symbolic link
 */
export function createSymlink(target: string, linkPath: string): void {
  const linkDir = path.dirname(linkPath);
  ensureDir(linkDir);
  
  // Remove existing link/file
  if (exists(linkPath)) {
    remove(linkPath);
  }
  
  fs.symlinkSync(target, linkPath, 'dir');
}

/**
 * Get real path of symbolic link
 */
export function getRealPath(linkPath: string): string {
  return fs.realpathSync(linkPath);
}

/**
 * Find project root by looking for skills.json
 */
export function findProjectRoot(startDir: string = process.cwd()): string | null {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;
  
  while (currentDir !== root) {
    if (exists(path.join(currentDir, 'skills.json'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  
  return null;
}

/**
 * Get skills.json path for current project
 */
export function getSkillsJsonPath(projectRoot?: string): string {
  const root = projectRoot || process.cwd();
  return path.join(root, 'skills.json');
}

/**
 * Get skills.lock path for current project
 */
export function getSkillsLockPath(projectRoot?: string): string {
  const root = projectRoot || process.cwd();
  return path.join(root, 'skills.lock');
}

/**
 * Get default skills installation directory
 */
export function getSkillsDir(projectRoot?: string, installDir = '.skills'): string {
  const root = projectRoot || process.cwd();
  return path.join(root, installDir);
}

/**
 * Get global cache directory
 */
export function getCacheDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return process.env.RESKILL_CACHE_DIR || path.join(home, '.reskill-cache');
}

/**
 * Get home directory
 */
export function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || '';
}

/**
 * Get global skills installation directory (~/.claude/skills)
 * @deprecated Use getAgentGlobalSkillsDir from agent-registry instead
 */
export function getGlobalSkillsDir(): string {
  const home = getHomeDir();
  return path.join(home, '.claude', 'skills');
}

// ============================================================================
// Multi-Agent 路径工具
// ============================================================================

/**
 * 规范 skills 目录名称
 */
const AGENTS_DIR = '.agents';
const SKILLS_SUBDIR = 'skills';

/**
 * 获取规范 skills 目录路径
 *
 * 规范位置: .agents/skills/ (项目级) 或 ~/.agents/skills/ (全局)
 * 这是 skill 源文件的存储位置，各 agent 目录通过符号链接指向这里
 */
export function getCanonicalSkillsDir(
  options: { global?: boolean; cwd?: string } = {}
): string {
  const { global: isGlobal = false, cwd } = options;
  const baseDir = isGlobal ? getHomeDir() : cwd || process.cwd();
  return path.join(baseDir, AGENTS_DIR, SKILLS_SUBDIR);
}

/**
 * 获取规范 skill 路径
 */
export function getCanonicalSkillPath(
  skillName: string,
  options: { global?: boolean; cwd?: string } = {}
): string {
  return path.join(getCanonicalSkillsDir(options), skillName);
}

/**
 * 缩短路径显示 (将 home 目录替换为 ~)
 */
export function shortenPath(fullPath: string, cwd?: string): string {
  const home = getHomeDir();
  const currentDir = cwd || process.cwd();

  if (fullPath.startsWith(home)) {
    return fullPath.replace(home, '~');
  }
  if (fullPath.startsWith(currentDir)) {
    return '.' + fullPath.slice(currentDir.length);
  }
  return fullPath;
}

/**
 * 验证路径安全性 (防止路径遍历攻击)
 */
export function isPathSafe(basePath: string, targetPath: string): boolean {
  const normalizedBase = path.normalize(path.resolve(basePath));
  const normalizedTarget = path.normalize(path.resolve(targetPath));

  return (
    normalizedTarget.startsWith(normalizedBase + path.sep) ||
    normalizedTarget === normalizedBase
  );
}

/**
 * 清理文件名 (防止路径遍历攻击)
 */
export function sanitizeName(name: string): string {
  // 移除路径分隔符和特殊字符
  let sanitized = name.replace(/[/\\:\0]/g, '');
  // 移除开头和结尾的点和空格
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');
  // 移除开头的点
  sanitized = sanitized.replace(/^\.+/, '');

  if (!sanitized || sanitized.length === 0) {
    sanitized = 'unnamed-skill';
  }

  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }

  return sanitized;
}
