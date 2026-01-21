import * as path from 'node:path';
import type { InstalledSkill, SkillJson, InstallOptions } from '../types/index.js';
import { GitResolver } from './git-resolver.js';
import { CacheManager } from './cache-manager.js';
import { ConfigLoader } from './config-loader.js';
import { LockManager } from './lock-manager.js';
import { Installer, type InstallResult, type InstallMode } from './installer.js';
import {
  type AgentType,
  detectInstalledAgents,
  isValidAgentType,
  agents,
} from './agent-registry.js';
import {
  exists,
  readJson,
  remove,
  listDir,
  isDirectory,
  isSymlink,
  createSymlink,
  getRealPath,
  ensureDir,
  getGlobalSkillsDir,
} from '../utils/fs.js';
import { logger } from '../utils/logger.js';

/**
 * SkillManager 配置选项
 */
export interface SkillManagerOptions {
  /** 全局模式，安装到 ~/.claude/skills */
  global?: boolean;
}

/**
 * SkillManager - 核心 Skill 管理类
 * 
 * 整合 GitResolver, CacheManager, ConfigLoader, LockManager
 * 提供完整的 skill 安装、更新、卸载功能
 * 
 * 安装目录:
 * - 项目模式 (默认): .skills/ 或 skills.json 中配置的目录
 * - 全局模式 (-g): ~/.claude/skills/
 */
export class SkillManager {
  private projectRoot: string;
  private resolver: GitResolver;
  private cache: CacheManager;
  private config: ConfigLoader;
  private lockManager: LockManager;
  private isGlobal: boolean;

  constructor(projectRoot?: string, options?: SkillManagerOptions) {
    this.projectRoot = projectRoot || process.cwd();
    this.isGlobal = options?.global || false;
    this.config = new ConfigLoader(this.projectRoot);
    this.lockManager = new LockManager(this.projectRoot);
    this.cache = new CacheManager();
    
    // 使用配置中的默认 registry
    const defaults = this.config.getDefaults();
    this.resolver = new GitResolver(defaults.registry);
  }

  /**
   * 是否为全局模式
   */
  isGlobalMode(): boolean {
    return this.isGlobal;
  }

  /**
   * 获取项目根目录
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * 获取安装目录
   * 
   * - 全局模式: ~/.claude/skills/
   * - 项目模式: .skills/ 或 skills.json 中配置的目录
   */
  getInstallDir(): string {
    if (this.isGlobal) {
      return getGlobalSkillsDir();
    }
    return this.config.getInstallDir();
  }

  /**
   * 获取 skill 安装路径
   */
  getSkillPath(name: string): string {
    return path.join(this.getInstallDir(), name);
  }

  /**
   * 安装 skill
   */
  async install(ref: string, options: InstallOptions = {}): Promise<InstalledSkill> {
    const { force = false, save = true } = options;

    // 解析引用
    const resolved = await this.resolver.resolve(ref);
    const { parsed, repoUrl } = resolved;
    const version = resolved.ref;
    const skillName = parsed.subPath 
      ? path.basename(parsed.subPath) 
      : parsed.repo;

    const skillPath = this.getSkillPath(skillName);

    // 检查是否已安装
    if (exists(skillPath) && !force) {
      const locked = this.lockManager.get(skillName);
      if (locked && locked.version === version) {
        logger.info(`${skillName}@${version} is already installed`);
        return this.getInstalledSkill(skillName)!;
      }
      
      if (!force) {
        logger.warn(`${skillName} is already installed. Use --force to reinstall.`);
        return this.getInstalledSkill(skillName)!;
      }
    }

    logger.package(`Installing ${skillName}@${version}...`);

    // 检查缓存
    let cacheResult = await this.cache.get(parsed, version);

    if (!cacheResult) {
      logger.debug(`Caching ${skillName}@${version} from ${repoUrl}`);
      cacheResult = await this.cache.cache(repoUrl, parsed, version, version);
    } else {
      logger.debug(`Using cached ${skillName}@${version}`);
    }

    // 复制到安装目录
    ensureDir(this.getInstallDir());
    
    if (exists(skillPath)) {
      remove(skillPath);
    }
    
    await this.cache.copyTo(parsed, version, skillPath);

    // 更新 lock 文件 (仅项目模式)
    if (!this.isGlobal) {
      this.lockManager.lockSkill(skillName, {
        source: `${parsed.registry}:${parsed.owner}/${parsed.repo}${parsed.subPath ? '/' + parsed.subPath : ''}`,
        version,
        resolved: repoUrl,
        commit: cacheResult.commit,
      });
    }

    // 更新 skills.json (仅项目模式)
    if (!this.isGlobal && save && this.config.exists()) {
      this.config.addSkill(skillName, ref);
    }

    const locationHint = this.isGlobal ? '(global)' : '';
    logger.success(`Installed ${skillName}@${version} to ${skillPath} ${locationHint}`.trim());

    return this.getInstalledSkill(skillName)!;
  }

  /**
   * 安装所有 skills.json 中的 skills
   */
  async installAll(options: InstallOptions = {}): Promise<InstalledSkill[]> {
    const skills = this.config.getSkills();
    const installed: InstalledSkill[] = [];

    for (const [name, ref] of Object.entries(skills)) {
      try {
        const skill = await this.install(ref, { ...options, save: false });
        installed.push(skill);
      } catch (error) {
        logger.error(`Failed to install ${name}: ${(error as Error).message}`);
      }
    }

    return installed;
  }

  /**
   * 卸载 skill
   */
  uninstall(name: string): boolean {
    const skillPath = this.getSkillPath(name);

    if (!exists(skillPath)) {
      const location = this.isGlobal ? '(global)' : '';
      logger.warn(`Skill ${name} is not installed ${location}`.trim());
      return false;
    }

    // 删除安装目录
    remove(skillPath);

    // 从 lock 文件移除 (仅项目模式)
    if (!this.isGlobal) {
      this.lockManager.remove(name);
    }

    // 从 skills.json 移除 (仅项目模式)
    if (!this.isGlobal && this.config.exists()) {
      this.config.removeSkill(name);
    }

    const locationHint = this.isGlobal ? '(global)' : '';
    logger.success(`Uninstalled ${name} ${locationHint}`.trim());
    return true;
  }

  /**
   * 更新 skill
   */
  async update(name?: string): Promise<InstalledSkill[]> {
    const updated: InstalledSkill[] = [];

    if (name) {
      // 更新单个 skill
      const ref = this.config.getSkillRef(name);
      if (!ref) {
        logger.error(`Skill ${name} not found in skills.json`);
        return [];
      }

      const skill = await this.install(ref, { force: true, save: false });
      updated.push(skill);
    } else {
      // 更新所有
      const skills = this.config.getSkills();
      for (const [skillName, ref] of Object.entries(skills)) {
        try {
          const skill = await this.install(ref, { force: true, save: false });
          updated.push(skill);
        } catch (error) {
          logger.error(`Failed to update ${skillName}: ${(error as Error).message}`);
        }
      }
    }

    return updated;
  }

  /**
   * 链接本地 skill
   */
  link(localPath: string, name?: string): InstalledSkill {
    const absolutePath = path.resolve(localPath);

    if (!exists(absolutePath)) {
      throw new Error(`Path ${localPath} does not exist`);
    }

    // 读取 skill.json 获取名称
    const skillJsonPath = path.join(absolutePath, 'skill.json');
    let skillName = name || path.basename(absolutePath);
    
    if (exists(skillJsonPath)) {
      try {
        const skillJson = readJson<SkillJson>(skillJsonPath);
        skillName = name || skillJson.name || skillName;
      } catch {
        // 忽略解析错误
      }
    }

    const linkPath = this.getSkillPath(skillName);
    
    ensureDir(this.getInstallDir());
    createSymlink(absolutePath, linkPath);

    logger.success(`Linked ${skillName} → ${absolutePath}`);

    return {
      name: skillName,
      path: linkPath,
      version: 'local',
      source: absolutePath,
      isLinked: true,
    };
  }

  /**
   * 取消链接
   */
  unlink(name: string): boolean {
    const skillPath = this.getSkillPath(name);

    if (!exists(skillPath)) {
      logger.warn(`Skill ${name} is not installed`);
      return false;
    }

    if (!isSymlink(skillPath)) {
      logger.warn(`Skill ${name} is not a linked skill`);
      return false;
    }

    remove(skillPath);
    logger.success(`Unlinked ${name}`);
    return true;
  }

  /**
   * 列出已安装的 skills
   */
  list(): InstalledSkill[] {
    const installDir = this.getInstallDir();
    
    if (!exists(installDir)) {
      return [];
    }

    const skills: InstalledSkill[] = [];
    const dirs = listDir(installDir);

    for (const name of dirs) {
      const skillPath = path.join(installDir, name);
      
      if (!isDirectory(skillPath)) {
        continue;
      }

      const skill = this.getInstalledSkill(name);
      if (skill) {
        skills.push(skill);
      }
    }

    return skills;
  }

  /**
   * 获取已安装的 skill 信息
   */
  getInstalledSkill(name: string): InstalledSkill | null {
    const skillPath = this.getSkillPath(name);

    if (!exists(skillPath)) {
      return null;
    }

    const isLinked = isSymlink(skillPath);
    const locked = this.lockManager.get(name);

    let metadata: SkillJson | undefined;
    const skillJsonPath = path.join(skillPath, 'skill.json');
    
    if (exists(skillJsonPath)) {
      try {
        metadata = readJson<SkillJson>(skillJsonPath);
      } catch {
        // 忽略解析错误
      }
    }

    return {
      name,
      path: skillPath,
      version: isLinked ? 'local' : (locked?.version || metadata?.version || 'unknown'),
      source: isLinked ? getRealPath(skillPath) : (locked?.source || ''),
      metadata,
      isLinked,
    };
  }

  /**
   * 获取 skill 详情
   */
  getInfo(name: string): {
    installed: InstalledSkill | null;
    locked: ReturnType<LockManager['get']>;
    config: string | undefined;
  } {
    return {
      installed: this.getInstalledSkill(name),
      locked: this.lockManager.get(name),
      config: this.config.getSkillRef(name),
    };
  }

  /**
   * 检查过期的 skills
   */
  async checkOutdated(): Promise<Array<{
    name: string;
    current: string;
    latest: string;
    updateAvailable: boolean;
  }>> {
    const results: Array<{
      name: string;
      current: string;
      latest: string;
      updateAvailable: boolean;
    }> = [];

    const skills = this.config.getSkills();

    for (const [name, ref] of Object.entries(skills)) {
      try {
        const locked = this.lockManager.get(name);
        const current = locked?.version || 'unknown';

        // 解析最新版本
        const parsed = this.resolver.parseRef(ref);
        const repoUrl = this.resolver.buildRepoUrl(parsed);
        
        // 强制获取 latest
        const latestResolved = await this.resolver.resolveVersion(repoUrl, {
          type: 'latest',
          value: 'latest',
          raw: 'latest',
        });

        const latest = latestResolved.ref;
        const updateAvailable = current !== latest && current !== 'unknown';

        results.push({
          name,
          current,
          latest,
          updateAvailable,
        });
      } catch (error) {
        logger.debug(`Failed to check ${name}: ${(error as Error).message}`);
        results.push({
          name,
          current: 'unknown',
          latest: 'unknown',
          updateAvailable: false,
        });
      }
    }

    return results;
  }

  // ============================================================================
  // Multi-Agent 安装方法
  // ============================================================================

  /**
   * 安装 skill 到多个 agents
   *
   * @param ref - Skill 引用 (如 github:user/repo@v1.0.0)
   * @param targetAgents - 目标 agents 列表
   * @param options - 安装选项
   */
  async installToAgents(
    ref: string,
    targetAgents: AgentType[],
    options: InstallOptions = {}
  ): Promise<{
    skill: InstalledSkill;
    results: Map<AgentType, InstallResult>;
  }> {
    const { save = true, mode = 'symlink' } = options;

    // 解析引用
    const resolved = await this.resolver.resolve(ref);
    const { parsed, repoUrl } = resolved;
    const version = resolved.ref;
    const skillName = parsed.subPath
      ? path.basename(parsed.subPath)
      : parsed.repo;

    logger.package(`Installing ${skillName}@${version} to ${targetAgents.length} agent(s)...`);

    // 检查缓存
    let cacheResult = await this.cache.get(parsed, version);

    if (!cacheResult) {
      logger.debug(`Caching ${skillName}@${version} from ${repoUrl}`);
      cacheResult = await this.cache.cache(repoUrl, parsed, version, version);
    } else {
      logger.debug(`Using cached ${skillName}@${version}`);
    }

    // 获取缓存路径作为源
    const sourcePath = this.cache.getCachePath(parsed, version);

    // 创建 Installer
    const installer = new Installer({
      cwd: this.projectRoot,
      global: this.isGlobal,
    });

    // 安装到所有目标 agents
    const results = await installer.installToAgents(
      sourcePath,
      skillName,
      targetAgents,
      { mode: mode as InstallMode }
    );

    // 更新 lock 文件 (仅项目模式)
    if (!this.isGlobal) {
      this.lockManager.lockSkill(skillName, {
        source: `${parsed.registry}:${parsed.owner}/${parsed.repo}${parsed.subPath ? '/' + parsed.subPath : ''}`,
        version,
        resolved: repoUrl,
        commit: cacheResult.commit,
      });
    }

    // 更新 skills.json (仅项目模式)
    if (!this.isGlobal && save && this.config.exists()) {
      this.config.addSkill(skillName, ref);
    }

    // 统计结果
    const successCount = Array.from(results.values()).filter((r) => r.success).length;
    const failCount = results.size - successCount;

    if (failCount === 0) {
      logger.success(`Installed ${skillName}@${version} to ${successCount} agent(s)`);
    } else {
      logger.warn(
        `Installed ${skillName}@${version} to ${successCount} agent(s), ${failCount} failed`
      );
    }

    // 构建返回的 InstalledSkill
    const skill: InstalledSkill = {
      name: skillName,
      path: sourcePath,
      version,
      source: `${parsed.registry}:${parsed.owner}/${parsed.repo}${parsed.subPath ? '/' + parsed.subPath : ''}`,
    };

    return { skill, results };
  }

  /**
   * 获取默认的目标 agents
   *
   * 优先级:
   * 1. skills.json 中的 defaults.targetAgents
   * 2. 自动检测已安装的 agents
   * 3. 返回空数组
   */
  async getDefaultTargetAgents(): Promise<AgentType[]> {
    // 从配置读取
    const defaults = this.config.getDefaults();
    if (defaults.targetAgents && defaults.targetAgents.length > 0) {
      return defaults.targetAgents.filter(isValidAgentType) as AgentType[];
    }

    // 自动检测
    return detectInstalledAgents();
  }

  /**
   * 获取默认安装模式
   */
  getDefaultInstallMode(): InstallMode {
    const defaults = this.config.getDefaults();
    if (defaults.installMode === 'copy' || defaults.installMode === 'symlink') {
      return defaults.installMode;
    }
    return 'symlink';
  }

  /**
   * 验证 agent 类型列表
   */
  validateAgentTypes(agentNames: string[]): { valid: AgentType[]; invalid: string[] } {
    const valid: AgentType[] = [];
    const invalid: string[] = [];

    for (const name of agentNames) {
      if (isValidAgentType(name)) {
        valid.push(name);
      } else {
        invalid.push(name);
      }
    }

    return { valid, invalid };
  }

  /**
   * 获取所有可用的 agent 类型
   */
  getAllAgentTypes(): AgentType[] {
    return Object.keys(agents) as AgentType[];
  }

  /**
   * 从指定 agents 卸载 skill
   */
  uninstallFromAgents(name: string, targetAgents: AgentType[]): Map<AgentType, boolean> {
    const installer = new Installer({
      cwd: this.projectRoot,
      global: this.isGlobal,
    });

    const results = installer.uninstallFromAgents(name, targetAgents);

    // 从 lock 文件移除 (仅项目模式)
    if (!this.isGlobal) {
      this.lockManager.remove(name);
    }

    // 从 skills.json 移除 (仅项目模式)
    if (!this.isGlobal && this.config.exists()) {
      this.config.removeSkill(name);
    }

    const successCount = Array.from(results.values()).filter((r) => r).length;
    logger.success(`Uninstalled ${name} from ${successCount} agent(s)`);

    return results;
  }
}

export default SkillManager;
