import * as path from 'node:path';
import type { SkillsDefaults, SkillsJson } from '../types/index.js';
import { exists, getSkillsJsonPath, readJson, writeJson } from '../utils/fs.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default skills.json configuration template
 */
const DEFAULT_SKILLS_JSON: SkillsJson = {
  skills: {},
  registries: {
    github: 'https://github.com',
  },
  defaults: {
    installDir: '.skills',
  },
};

/**
 * Default values for SkillsDefaults fields
 * Note: publishRegistry has no default - must be explicitly configured
 */
const DEFAULT_VALUES: Omit<Required<SkillsDefaults>, 'publishRegistry'> & {
  publishRegistry: undefined;
} = {
  installDir: '.skills',
  targetAgents: [],
  installMode: 'symlink',
  publishRegistry: undefined,
};

/**
 * Well-known registry URLs
 */
export const DEFAULT_REGISTRIES: Record<string, string> = {
  github: 'https://github.com',
  gitlab: 'https://gitlab.com',
};

// ============================================================================
// ConfigLoader Class
// ============================================================================

/**
 * ConfigLoader - Load and manage skills.json configuration
 *
 * Handles reading, writing, and managing the project's skills.json file.
 * Provides methods for:
 * - Loading/saving configuration
 * - Managing skill dependencies
 * - Managing default settings (registry, installDir, targetAgents, installMode)
 *
 * @example
 * ```ts
 * const config = new ConfigLoader();
 * if (config.exists()) {
 *   const defaults = config.getDefaults();
 *   console.log(defaults.targetAgents);
 * }
 * ```
 */
export class ConfigLoader {
  private readonly projectRoot: string;
  private readonly configPath: string;
  private config: SkillsJson | null = null;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot ?? process.cwd();
    this.configPath = getSkillsJsonPath(this.projectRoot);
  }

  // ==========================================================================
  // Path Accessors
  // ==========================================================================

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
   * Get installation directory (resolved absolute path)
   */
  getInstallDir(): string {
    const { installDir } = this.getDefaults();
    return path.join(this.projectRoot, installDir);
  }

  // ==========================================================================
  // File Operations
  // ==========================================================================

  /**
   * Check if configuration file exists
   */
  exists(): boolean {
    return exists(this.configPath);
  }

  /**
   * Load configuration from file
   *
   * @throws Error if file doesn't exist or is invalid JSON
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
   * Reload configuration from file (ignores cache)
   */
  reload(): SkillsJson {
    this.config = null;
    return this.load();
  }

  /**
   * Save configuration to file
   *
   * @param config - Configuration to save (uses cached config if not provided)
   * @throws Error if no configuration to save
   */
  save(config?: SkillsJson): void {
    const toSave = config ?? this.config;
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
   * Create new configuration file with defaults
   *
   * @param options - Optional overrides for default configuration
   */
  create(options?: Partial<SkillsJson>): SkillsJson {
    const config: SkillsJson = {
      ...DEFAULT_SKILLS_JSON,
      ...options,
      skills: options?.skills ?? {},
      // Deep copy registries to avoid mutating the default object
      registries: {
        ...DEFAULT_SKILLS_JSON.registries,
        ...options?.registries,
      },
      defaults: {
        ...DEFAULT_SKILLS_JSON.defaults,
        ...options?.defaults,
      },
    };

    this.save(config);
    return config;
  }

  // ==========================================================================
  // Defaults Management
  // ==========================================================================

  /**
   * Get default configuration values
   *
   * Returns a complete defaults object with all fields populated.
   * Uses stored values if available, falls back to defaults.
   * Note: publishRegistry may be undefined (no default value).
   */
  getDefaults(): Omit<Required<SkillsDefaults>, 'publishRegistry'> & {
    publishRegistry: string | undefined;
  } {
    const config = this.getConfigOrDefault();
    const storedDefaults = config.defaults ?? {};

    return {
      installDir: storedDefaults.installDir ?? DEFAULT_VALUES.installDir,
      targetAgents: storedDefaults.targetAgents ?? DEFAULT_VALUES.targetAgents,
      installMode: storedDefaults.installMode ?? DEFAULT_VALUES.installMode,
      publishRegistry: storedDefaults.publishRegistry,
    };
  }

  /**
   * Get publish registry URL
   *
   * Returns the configured publish registry URL, or undefined if not configured.
   * This intentionally has no default value - users must explicitly configure
   * their registry to prevent accidental publishing to unintended registries.
   */
  getPublishRegistry(): string | undefined {
    const config = this.getConfigOrDefault();
    return config.defaults?.publishRegistry;
  }

  /**
   * Update default configuration values
   *
   * Merges the provided updates with existing defaults and saves to file.
   *
   * @param updates - Partial defaults to merge
   */
  updateDefaults(updates: Partial<SkillsDefaults>): void {
    this.ensureConfigLoaded();

    if (this.config) {
      this.config.defaults = {
        ...this.config.defaults,
        ...updates,
      };
      this.save();
    }
  }

  // ==========================================================================
  // Registry Management
  // ==========================================================================

  /**
   * Get all configured registries (custom + default).
   */
  getRegistries(): Record<string, string> {
    const config = this.getConfigOrDefault();
    return {
      ...DEFAULT_REGISTRIES,
      ...config.registries,
    };
  }

  /**
   * Get registry URL by name
   *
   * Resolution order:
   * 1. Custom registries defined in skills.json
   * 2. Well-known registries (github, gitlab)
   * 3. Assumes it's a custom domain (https://{registryName})
   */
  getRegistryUrl(registryName: string): string {
    const config = this.getConfigOrDefault();

    // Check custom registries
    if (config.registries?.[registryName]) {
      return config.registries[registryName];
    }

    // Check well-known registries
    if (DEFAULT_REGISTRIES[registryName]) {
      return DEFAULT_REGISTRIES[registryName];
    }

    // Assume it's a custom domain
    return `https://${registryName}`;
  }

  /**
   * Find registry name for a given URL
   *
   * Reverse lookup: finds which registry (if any) matches the URL.
   * Custom registries are checked first, then well-known registries.
   *
   * @param url - The URL to match (e.g., "https://gitlab.company.com/team/tool")
   * @returns The registry name if found, or undefined
   */
  findRegistryForUrl(url: string): string | undefined {
    const config = this.getConfigOrDefault();

    // Normalize URL - remove trailing slash
    const normalizedUrl = url.replace(/\/$/, '');

    // Check custom registries first (higher priority)
    if (config.registries) {
      for (const [name, registryUrl] of Object.entries(config.registries)) {
        const normalizedRegistryUrl = registryUrl.replace(/\/$/, '');
        if (normalizedUrl.startsWith(normalizedRegistryUrl)) {
          return name;
        }
      }
    }

    // Check well-known registries
    for (const [name, registryUrl] of Object.entries(DEFAULT_REGISTRIES)) {
      const normalizedRegistryUrl = registryUrl.replace(/\/$/, '');
      if (normalizedUrl.startsWith(normalizedRegistryUrl)) {
        return name;
      }
    }

    return undefined;
  }

  /**
   * Normalize a skill reference to use registry shorthand if possible
   *
   * Converts full URLs to registry format when they match a configured registry.
   * E.g., "https://gitlab.company.com/team/tool@v1.0.0" → "internal:team/tool@v1.0.0"
   *       (if "internal": "https://gitlab.company.com" is configured)
   *
   * @param ref - The skill reference to normalize
   * @returns Normalized reference using registry shorthand, or original if no match
   */
  normalizeSkillRef(ref: string): string {
    // Check if it's an SSH URL (git@...) - must check first as it contains ':'
    if (ref.startsWith('git@')) {
      return this.normalizeGitSshUrl(ref);
    }

    // Check if it's an HTTPS URL
    if (ref.startsWith('https://') || ref.startsWith('http://')) {
      return this.normalizeHttpsUrl(ref);
    }

    // Check if it's already in registry format (contains : but not a URL)
    // At this point we've excluded git@ and http(s):// URLs
    if (ref.includes(':')) {
      return ref;
    }

    return ref;
  }

  /**
   * Normalize an HTTPS URL to registry format
   */
  private normalizeHttpsUrl(ref: string): string {
    // Extract version part if present
    let url = ref;
    let version = '';

    // Handle .git suffix with version
    const gitVersionMatch = ref.match(/^(.+\.git)(@.+)$/);
    if (gitVersionMatch) {
      url = gitVersionMatch[1];
      version = gitVersionMatch[2];
    } else {
      // Handle URL without .git suffix
      const versionMatch = ref.match(/^(.+?)(@[^@]+)$/);
      if (versionMatch && !versionMatch[1].includes('@')) {
        url = versionMatch[1];
        version = versionMatch[2];
      }
    }

    // Find matching registry
    const registryName = this.findRegistryForUrl(url);
    if (!registryName) {
      return ref;
    }

    const registryUrl = this.getRegistryUrl(registryName).replace(/\/$/, '');

    // Extract the path after registry URL
    let path = url.replace(registryUrl, '').replace(/^\//, '');
    // Remove .git suffix if present
    path = path.replace(/\.git$/, '');

    if (!path) {
      return ref;
    }

    return `${registryName}:${path}${version}`;
  }

  /**
   * Normalize a Git SSH URL to registry format
   */
  private normalizeGitSshUrl(ref: string): string {
    // Parse: git@host:owner/repo.git[@version] or git@host:owner/repo[@version]
    // The .git suffix and @version are both optional
    // Use greedy match for repoPath (.+) to ensure .git is captured as part of the path,
    // then explicitly remove it. This avoids issues with non-greedy matching and optional groups.
    const match = ref.match(/^git@([^:]+):(.+?)(@[^@]+)?$/);
    if (!match) {
      return ref;
    }

    const [, host, rawRepoPath, version = ''] = match;

    // Remove .git suffix if present
    const repoPath = rawRepoPath.replace(/\.git$/, '');

    const testUrl = `https://${host}`;

    // Find matching registry
    const registryName = this.findRegistryForUrl(testUrl);
    if (!registryName) {
      return ref;
    }

    return `${registryName}:${repoPath}${version}`;
  }

  // ==========================================================================
  // Skills Management
  // ==========================================================================

  /**
   * Add skill to configuration
   *
   * Also auto-adds the registry to the registries field if it's a well-known registry.
   */
  addSkill(name: string, ref: string): void {
    this.ensureConfigLoaded();

    if (this.config) {
      this.config.skills[name] = ref;

      // Auto-add registry if it's a well-known registry
      const registryName = this.extractRegistryFromRef(ref);
      if (registryName && DEFAULT_REGISTRIES[registryName]) {
        this.addRegistry(registryName, DEFAULT_REGISTRIES[registryName]);
      }

      this.save();
    }
  }

  /**
   * Add registry to configuration
   *
   * Only adds if the registry doesn't already exist.
   * Note: This method requires config to be loaded first via load() or create().
   * If config is not loaded, this method is a no-op (silent return) since it's
   * typically called as a side effect of addSkill() which handles config loading.
   *
   * @param name - Registry name (e.g., 'github', 'gitlab', 'internal')
   * @param url - Registry URL (e.g., 'https://github.com')
   */
  addRegistry(name: string, url: string): void {
    if (!this.config) {
      // Config not loaded - this is expected when called before load()/create()
      // Callers like addSkill() ensure config is loaded before calling this
      return;
    }

    if (!this.config.registries) {
      this.config.registries = {};
    }

    // Don't overwrite existing registries
    if (!this.config.registries[name]) {
      this.config.registries[name] = url;
    }
  }

  /**
   * Extract registry name from a skill reference
   *
   * @example
   * extractRegistryFromRef('github:user/repo@v1.0.0') // 'github'
   * extractRegistryFromRef('gitlab:user/repo') // 'gitlab'
   * extractRegistryFromRef('https://github.com/user/repo') // undefined
   */
  private extractRegistryFromRef(ref: string): string | undefined {
    // Check for registry format: registry:path[@version]
    const match = ref.match(/^([a-zA-Z][a-zA-Z0-9-]*):(.+)$/);
    if (match) {
      const registryName = match[1];
      // Exclude URL protocols (http, https, git, ssh)
      if (!['http', 'https', 'git', 'ssh'].includes(registryName.toLowerCase())) {
        return registryName;
      }
    }
    return undefined;
  }

  /**
   * Remove skill from configuration
   *
   * @returns true if skill was removed, false if it didn't exist
   */
  removeSkill(name: string): boolean {
    this.ensureConfigLoaded();

    if (this.config?.skills[name]) {
      delete this.config.skills[name];
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Get all skills as a shallow copy
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
   * Check if skill exists in configuration
   */
  hasSkill(name: string): boolean {
    const skills = this.getSkills();
    return name in skills;
  }

  /**
   * Get skill reference by name
   */
  getSkillRef(name: string): string | undefined {
    const skills = this.getSkills();
    return skills[name];
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Get loaded config or default (does not throw)
   */
  private getConfigOrDefault(): SkillsJson {
    if (this.config) {
      return this.config;
    }
    if (this.exists()) {
      return this.load();
    }
    return DEFAULT_SKILLS_JSON;
  }

  /**
   * Ensure config is loaded into memory
   */
  private ensureConfigLoaded(): void {
    if (!this.config) {
      this.load();
    }
  }
}

export default ConfigLoader;
