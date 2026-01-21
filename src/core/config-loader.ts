import * as path from 'node:path';
import type { SkillsJson, SkillsDefaults } from '../types/index.js';
import { exists, readJson, writeJson, getSkillsJsonPath } from '../utils/fs.js';

/**
 * 默认配置
 */
const DEFAULT_SKILLS_JSON: SkillsJson = {
  skills: {},
  defaults: {
    registry: 'github',
    installDir: '.skills',
  },
};

/**
 * 默认 registry URLs
 */
export const DEFAULT_REGISTRIES: Record<string, string> = {
  github: 'https://github.com',
  gitlab: 'https://gitlab.com',
};

/**
 * ConfigLoader - 加载和管理 skills.json 配置
 */
export class ConfigLoader {
  private projectRoot: string;
  private configPath: string;
  private config: SkillsJson | null = null;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.configPath = getSkillsJsonPath(this.projectRoot);
  }

  /**
   * 获取项目根目录
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 检查配置文件是否存在
   */
  exists(): boolean {
    return exists(this.configPath);
  }

  /**
   * 加载配置
   */
  load(): SkillsJson {
    if (this.config) {
      return this.config;
    }

    if (!this.exists()) {
      throw new Error(
        `skills.json not found in ${this.projectRoot}. Run 'reskill init' first.`
      );
    }

    try {
      this.config = readJson<SkillsJson>(this.configPath);
      return this.config;
    } catch (error) {
      throw new Error(`Failed to parse skills.json: ${(error as Error).message}`);
    }
  }

  /**
   * 重新加载配置（忽略缓存）
   */
  reload(): SkillsJson {
    this.config = null;
    return this.load();
  }

  /**
   * 保存配置
   */
  save(config?: SkillsJson): void {
    const toSave = config || this.config;
    if (!toSave) {
      throw new Error('No config to save');
    }
    writeJson(this.configPath, toSave);
    this.config = toSave;
  }

  /**
   * 创建默认配置
   */
  create(options?: Partial<SkillsJson>): SkillsJson {
    const config: SkillsJson = {
      ...DEFAULT_SKILLS_JSON,
      ...options,
      skills: options?.skills || {},
      defaults: {
        ...DEFAULT_SKILLS_JSON.defaults,
        ...options?.defaults,
      },
    };

    this.save(config);
    return config;
  }

  /**
   * 获取默认配置
   */
  getDefaults(): Required<SkillsDefaults> {
    const config = this.config || (this.exists() ? this.load() : DEFAULT_SKILLS_JSON);
    return {
      registry: config.defaults?.registry || DEFAULT_SKILLS_JSON.defaults!.registry!,
      installDir: config.defaults?.installDir || DEFAULT_SKILLS_JSON.defaults!.installDir!,
      targetAgents: config.defaults?.targetAgents || [],
      installMode: config.defaults?.installMode || 'symlink',
    };
  }

  /**
   * 获取 registry URL
   */
  getRegistryUrl(registryName: string): string {
    const config = this.config || (this.exists() ? this.load() : DEFAULT_SKILLS_JSON);
    
    // 首先检查自定义 registries
    if (config.registries?.[registryName]) {
      return config.registries[registryName];
    }

    // 然后检查默认 registries
    if (DEFAULT_REGISTRIES[registryName]) {
      return DEFAULT_REGISTRIES[registryName];
    }

    // 假设是自定义域名
    return `https://${registryName}`;
  }

  /**
   * 获取安装目录
   */
  getInstallDir(): string {
    const defaults = this.getDefaults();
    return path.join(this.projectRoot, defaults.installDir);
  }

  /**
   * 添加 skill 到配置
   */
  addSkill(name: string, ref: string): void {
    if (!this.config) {
      this.load();
    }
    this.config!.skills[name] = ref;
    this.save();
  }

  /**
   * 移除 skill 从配置
   */
  removeSkill(name: string): boolean {
    if (!this.config) {
      this.load();
    }
    if (this.config!.skills[name]) {
      delete this.config!.skills[name];
      this.save();
      return true;
    }
    return false;
  }

  /**
   * 获取所有 skills
   */
  getSkills(): Record<string, string> {
    if (!this.config) {
      if (!this.exists()) {
        return {};
      }
      this.load();
    }
    return { ...this.config!.skills };
  }

  /**
   * 检查 skill 是否存在
   */
  hasSkill(name: string): boolean {
    const skills = this.getSkills();
    return name in skills;
  }

  /**
   * 获取 skill 引用
   */
  getSkillRef(name: string): string | undefined {
    const skills = this.getSkills();
    return skills[name];
  }
}

export default ConfigLoader;
