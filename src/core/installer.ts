/**
 * Installer - 多 Agent 安装器
 *
 * 支持两种安装模式:
 * - symlink: 规范位置 (.agents/skills/) + 符号链接到各 agent 目录
 * - copy: 直接复制到各 agent 目录
 *
 * 参考: https://github.com/vercel-labs/add-skill/blob/main/src/installer.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir, platform } from 'os';
import type { AgentType } from './agent-registry.js';
import { getAgentConfig } from './agent-registry.js';

/**
 * 安装模式
 */
export type InstallMode = 'symlink' | 'copy';

/**
 * 安装结果
 */
export interface InstallResult {
  /** 是否成功 */
  success: boolean;
  /** 安装路径 */
  path: string;
  /** 规范路径 (symlink 模式) */
  canonicalPath?: string;
  /** 安装模式 */
  mode: InstallMode;
  /** symlink 是否失败 (fallback to copy) */
  symlinkFailed?: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 安装选项
 */
export interface InstallerOptions {
  /** 全局安装 */
  global?: boolean;
  /** 当前工作目录 */
  cwd?: string;
  /** 安装模式 */
  mode?: InstallMode;
}

const AGENTS_DIR = '.agents';
const SKILLS_SUBDIR = 'skills';

/**
 * 清理文件名，防止路径遍历攻击
 */
function sanitizeName(name: string): string {
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

/**
 * 验证路径安全性
 */
function isPathSafe(basePath: string, targetPath: string): boolean {
  const normalizedBase = path.normalize(path.resolve(basePath));
  const normalizedTarget = path.normalize(path.resolve(targetPath));

  return (
    normalizedTarget.startsWith(normalizedBase + path.sep) ||
    normalizedTarget === normalizedBase
  );
}

/**
 * 获取规范 skills 目录路径
 */
function getCanonicalSkillsDir(isGlobal: boolean, cwd?: string): string {
  const baseDir = isGlobal ? homedir() : cwd || process.cwd();
  return path.join(baseDir, AGENTS_DIR, SKILLS_SUBDIR);
}

/**
 * 确保目录存在
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 删除文件或目录
 */
function remove(targetPath: string): void {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

/**
 * 复制目录
 */
function copyDirectory(
  src: string,
  dest: string,
  options?: { exclude?: string[] }
): void {
  const exclude = new Set(options?.exclude || ['README.md', 'metadata.json']);

  ensureDir(dest);

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    // 跳过以 _ 开头的文件和排除列表中的文件
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
 * 创建符号链接
 *
 * @returns true 如果成功，false 如果需要 fallback 到复制
 */
async function createSymlink(
  target: string,
  linkPath: string
): Promise<boolean> {
  try {
    // 检查已存在的链接
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
      // ELOOP = 循环符号链接, ENOENT = 不存在
      if (err && typeof err === 'object' && 'code' in err) {
        if ((err as { code: string }).code === 'ELOOP') {
          try {
            fs.rmSync(linkPath, { force: true });
          } catch {
            // 如果无法删除，符号链接创建会失败并触发复制回退
          }
        }
      }
      // 对于 ENOENT 或其他错误，继续尝试创建符号链接
    }

    // 确保父目录存在
    const linkDir = path.dirname(linkPath);
    ensureDir(linkDir);

    // 计算相对路径
    const relativePath = path.relative(linkDir, target);

    // Windows 使用 junction，其他系统使用默认
    const symlinkType = platform() === 'win32' ? 'junction' : undefined;

    fs.symlinkSync(relativePath, linkPath, symlinkType);
    return true;
  } catch {
    return false;
  }
}

/**
 * Installer 类 - 多 Agent 安装器
 */
export class Installer {
  private cwd: string;
  private isGlobal: boolean;

  constructor(options: { cwd?: string; global?: boolean } = {}) {
    this.cwd = options.cwd || process.cwd();
    this.isGlobal = options.global || false;
  }

  /**
   * 获取规范安装路径
   */
  getCanonicalPath(skillName: string): string {
    const sanitized = sanitizeName(skillName);
    const canonicalBase = getCanonicalSkillsDir(this.isGlobal, this.cwd);
    return path.join(canonicalBase, sanitized);
  }

  /**
   * 获取 agent 的 skill 安装路径
   */
  getAgentSkillPath(skillName: string, agentType: AgentType): string {
    const agent = getAgentConfig(agentType);
    const sanitized = sanitizeName(skillName);
    const agentBase = this.isGlobal
      ? agent.globalSkillsDir
      : path.join(this.cwd, agent.skillsDir);
    return path.join(agentBase, sanitized);
  }

  /**
   * 安装 skill 到指定 agent
   *
   * @param sourcePath - skill 源目录路径
   * @param skillName - skill 名称
   * @param agentType - 目标 agent 类型
   * @param options - 安装选项
   */
  async installForAgent(
    sourcePath: string,
    skillName: string,
    agentType: AgentType,
    options: { mode?: InstallMode } = {}
  ): Promise<InstallResult> {
    const agent = getAgentConfig(agentType);
    const installMode = options.mode || 'symlink';
    const sanitized = sanitizeName(skillName);

    // 规范位置
    const canonicalBase = getCanonicalSkillsDir(this.isGlobal, this.cwd);
    const canonicalDir = path.join(canonicalBase, sanitized);

    // Agent 特定位置
    const agentBase = this.isGlobal
      ? agent.globalSkillsDir
      : path.join(this.cwd, agent.skillsDir);
    const agentDir = path.join(agentBase, sanitized);

    // 验证路径安全性
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
      // Copy 模式：直接复制到 agent 位置
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

      // Symlink 模式：复制到规范位置，然后创建符号链接
      ensureDir(canonicalDir);
      remove(canonicalDir);
      copyDirectory(sourcePath, canonicalDir);

      const symlinkCreated = await createSymlink(canonicalDir, agentDir);

      if (!symlinkCreated) {
        // Symlink 失败，回退到复制
        try {
          remove(agentDir);
        } catch {
          // 忽略清理错误
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
   * 安装 skill 到多个 agents
   */
  async installToAgents(
    sourcePath: string,
    skillName: string,
    targetAgents: AgentType[],
    options: { mode?: InstallMode } = {}
  ): Promise<Map<AgentType, InstallResult>> {
    const results = new Map<AgentType, InstallResult>();

    for (const agent of targetAgents) {
      const result = await this.installForAgent(
        sourcePath,
        skillName,
        agent,
        options
      );
      results.set(agent, result);
    }

    return results;
  }

  /**
   * 检查 skill 是否已安装到指定 agent
   */
  isInstalled(skillName: string, agentType: AgentType): boolean {
    const skillPath = this.getAgentSkillPath(skillName, agentType);
    return fs.existsSync(skillPath);
  }

  /**
   * 从指定 agent 卸载 skill
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
   * 从多个 agents 卸载 skill
   */
  uninstallFromAgents(
    skillName: string,
    targetAgents: AgentType[]
  ): Map<AgentType, boolean> {
    const results = new Map<AgentType, boolean>();

    for (const agent of targetAgents) {
      results.set(agent, this.uninstallFromAgent(skillName, agent));
    }

    // 同时删除规范位置
    const canonicalPath = this.getCanonicalPath(skillName);
    if (fs.existsSync(canonicalPath)) {
      remove(canonicalPath);
    }

    return results;
  }

  /**
   * 获取所有已安装到指定 agent 的 skills
   */
  listInstalledSkills(agentType: AgentType): string[] {
    const agent = getAgentConfig(agentType);
    const skillsDir = this.isGlobal
      ? agent.globalSkillsDir
      : path.join(this.cwd, agent.skillsDir);

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
