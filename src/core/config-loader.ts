import * as path from 'node:path';
import type { SkillsDefaults, SkillsJson } from '../types/index.js';
import { exists, getSkillsJsonPath, readJson, writeJson } from '../utils/fs.js';

/**
 * Default configuration
 */
const DEFAULT_SKILLS_JSON: SkillsJson = {
  skills: {},
  defaults: {
    registry: 'github',
    installDir: '.skills',
  },
};

/**
 * Default registry URLs
 */
export const DEFAULT_REGISTRIES: Record<string, string> = {
  github: 'https://github.com',
  gitlab: 'https://gitlab.com',
};

/**
 * ConfigLoader - Load and manage skills.json configuration
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
   * Get project root directory
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Check if configuration file exists
   */
  exists(): boolean {
    return exists(this.configPath);
  }

  /**
   * Load configuration
   */
  load(): SkillsJson {
    if (this.config) {
      return this.config;
    }

    if (!this.exists()) {
      throw new Error(`skills.json not found in ${this.projectRoot}. Run 'reskill init' first.`);
    }

    try {
      this.config = readJson<SkillsJson>(this.configPath);
      return this.config;
    } catch (error) {
      throw new Error(`Failed to parse skills.json: ${(error as Error).message}`);
    }
  }

  /**
   * Reload configuration (ignore cache)
   */
  reload(): SkillsJson {
    this.config = null;
    return this.load();
  }

  /**
   * Save configuration
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
   * Ensure skills.json exists, create with defaults if not
   *
   * @returns true if file was created, false if it already existed
   */
  ensureExists(): boolean {
    if (this.exists()) {
      return false;
    }
    this.create();
    return true;
  }

  /**
   * Create default configuration
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
   * Get default configuration
   */
  getDefaults(): Required<SkillsDefaults> {
    const config = this.config || (this.exists() ? this.load() : DEFAULT_SKILLS_JSON);
    return {
      registry: config.defaults?.registry || 'github',
      installDir: config.defaults?.installDir || '.skills',
      targetAgents: config.defaults?.targetAgents || [],
      installMode: config.defaults?.installMode || 'symlink',
    };
  }

  /**
   * Get registry URL
   */
  getRegistryUrl(registryName: string): string {
    const config = this.config || (this.exists() ? this.load() : DEFAULT_SKILLS_JSON);

    // First check custom registries
    if (config.registries?.[registryName]) {
      return config.registries[registryName];
    }

    // Then check default registries
    if (DEFAULT_REGISTRIES[registryName]) {
      return DEFAULT_REGISTRIES[registryName];
    }

    // Assume it's a custom domain
    return `https://${registryName}`;
  }

  /**
   * Get installation directory
   */
  getInstallDir(): string {
    const defaults = this.getDefaults();
    return path.join(this.projectRoot, defaults.installDir);
  }

  /**
   * Add skill to configuration
   */
  addSkill(name: string, ref: string): void {
    if (!this.config) {
      this.load();
    }
    if (this.config) {
      this.config.skills[name] = ref;
    }
    this.save();
  }

  /**
   * Remove skill from configuration
   */
  removeSkill(name: string): boolean {
    if (!this.config) {
      this.load();
    }
    if (this.config?.skills[name]) {
      delete this.config.skills[name];
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Get all skills
   */
  getSkills(): Record<string, string> {
    if (!this.config) {
      if (!this.exists()) {
        return {};
      }
      this.load();
    }
    return { ...this.config?.skills };
  }

  /**
   * Check if skill exists
   */
  hasSkill(name: string): boolean {
    const skills = this.getSkills();
    return name in skills;
  }

  /**
   * Get skill reference
   */
  getSkillRef(name: string): string | undefined {
    const skills = this.getSkills();
    return skills[name];
  }
}

export default ConfigLoader;
