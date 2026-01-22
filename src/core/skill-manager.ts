import * as path from 'node:path';
import type { InstalledSkill, InstallOptions, SkillJson } from '../types/index.js';
import {
  ensureDir,
  exists,
  getGlobalSkillsDir,
  getRealPath,
  isDirectory,
  isSymlink,
  listDir,
  readJson,
  remove,
} from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import {
  type AgentType,
  agents,
  detectInstalledAgents,
  isValidAgentType,
} from './agent-registry.js';
import { CacheManager } from './cache-manager.js';
import { ConfigLoader } from './config-loader.js';
import { GitResolver } from './git-resolver.js';
import { Installer, type InstallMode, type InstallResult } from './installer.js';
import { LockManager } from './lock-manager.js';

/**
 * SkillManager configuration options
 */
export interface SkillManagerOptions {
  /** Global mode, install to ~/.claude/skills */
  global?: boolean;
}

/**
 * SkillManager - Core Skill management class
 *
 * Integrates GitResolver, CacheManager, ConfigLoader, LockManager
 * Provides complete skill installation, update, and uninstall functionality
 *
 * Installation directories:
 * - Project mode (default): .skills/ or directory configured in skills.json
 * - Global mode (-g): ~/.claude/skills/
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

    // Use default registry from configuration
    const defaults = this.config.getDefaults();
    this.resolver = new GitResolver(defaults.registry);
  }

  /**
   * Check if in global mode
   */
  isGlobalMode(): boolean {
    return this.isGlobal;
  }

  /**
   * Get project root directory
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * Get legacy installation directory (for backward compatibility)
   *
   * - Global mode: ~/.claude/skills/
   * - Project mode: .skills/ or directory configured in skills.json
   */
  getInstallDir(): string {
    if (this.isGlobal) {
      return getGlobalSkillsDir();
    }
    return this.config.getInstallDir();
  }

  /**
   * Get canonical skills directory
   *
   * This is the primary storage location used by installToAgents().
   * - Project mode: .agents/skills/
   * - Global mode: ~/.agents/skills/
   */
  getCanonicalSkillsDir(): string {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const baseDir = this.isGlobal ? home : this.projectRoot;
    return path.join(baseDir, '.agents', 'skills');
  }

  /**
   * Get skill installation path
   *
   * Checks canonical location first, then falls back to legacy location.
   */
  getSkillPath(name: string): string {
    // Check canonical location first (.agents/skills/)
    const canonicalPath = path.join(this.getCanonicalSkillsDir(), name);
    if (exists(canonicalPath)) {
      return canonicalPath;
    }

    // Fall back to legacy location (.skills/)
    const legacyPath = path.join(this.getInstallDir(), name);
    if (exists(legacyPath)) {
      return legacyPath;
    }

    // Default to canonical location for new installations
    return canonicalPath;
  }

  /**
   * Install skill
   */
  async install(ref: string, options: InstallOptions = {}): Promise<InstalledSkill> {
    const { force = false, save = true } = options;

    // Parse reference
    const resolved = await this.resolver.resolve(ref);
    const { parsed, repoUrl } = resolved;
    const gitRef = resolved.ref; // Git reference (tag, branch, commit)
    const skillName = parsed.subPath ? path.basename(parsed.subPath) : parsed.repo;

    const skillPath = this.getSkillPath(skillName);

    // Check if already installed
    if (exists(skillPath) && !force) {
      const locked = this.lockManager.get(skillName);
      // Compare ref if available, fallback to version for backward compatibility
      const lockedRef = locked?.ref || locked?.version;
      if (locked && lockedRef === gitRef) {
        logger.info(`${skillName}@${gitRef} is already installed`);
        const installed = this.getInstalledSkill(skillName);
        if (installed) return installed;
      }

      if (!force) {
        logger.warn(`${skillName} is already installed. Use --force to reinstall.`);
        const installed = this.getInstalledSkill(skillName);
        if (installed) return installed;
      }
    }

    logger.package(`Installing ${skillName}@${gitRef}...`);

    // Check cache
    let cacheResult = await this.cache.get(parsed, gitRef);

    if (!cacheResult) {
      logger.debug(`Caching ${skillName}@${gitRef} from ${repoUrl}`);
      cacheResult = await this.cache.cache(repoUrl, parsed, gitRef, gitRef);
    } else {
      logger.debug(`Using cached ${skillName}@${gitRef}`);
    }

    // Copy to installation directory
    ensureDir(this.getInstallDir());

    if (exists(skillPath)) {
      remove(skillPath);
    }

    await this.cache.copyTo(parsed, gitRef, skillPath);

    // Read semantic version from skill.json
    let semanticVersion = gitRef; // fallback to gitRef if no skill.json
    const skillJsonPath = path.join(skillPath, 'skill.json');
    if (exists(skillJsonPath)) {
      try {
        const skillJson = readJson<SkillJson>(skillJsonPath);
        if (skillJson.version) {
          semanticVersion = skillJson.version;
        }
      } catch {
        // Ignore parse errors, use gitRef as fallback
      }
    }

    // Update lock file (project mode only)
    if (!this.isGlobal) {
      this.lockManager.lockSkill(skillName, {
        source: `${parsed.registry}:${parsed.owner}/${parsed.repo}${parsed.subPath ? `/${parsed.subPath}` : ''}`,
        version: semanticVersion,
        ref: gitRef,
        resolved: repoUrl,
        commit: cacheResult.commit,
      });
    }

    // Update skills.json (project mode only)
    if (!this.isGlobal && save) {
      this.config.ensureExists();
      this.config.addSkill(skillName, ref);
    }

    const displayVersion = semanticVersion !== gitRef ? `${semanticVersion} (${gitRef})` : gitRef;
    const locationHint = this.isGlobal ? '(global)' : '';
    logger.success(`Installed ${skillName}@${displayVersion} to ${skillPath} ${locationHint}`.trim());

    const installed = this.getInstalledSkill(skillName);
    if (!installed) {
      throw new Error(`Failed to get installed skill info for ${skillName}`);
    }
    return installed;
  }

  /**
   * Install all skills from skills.json
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
   * Uninstall skill
   */
  uninstall(name: string): boolean {
    const skillPath = this.getSkillPath(name);

    if (!exists(skillPath)) {
      const location = this.isGlobal ? '(global)' : '';
      logger.warn(`Skill ${name} is not installed ${location}`.trim());
      return false;
    }

    // Remove installation directory
    remove(skillPath);

    // Remove from lock file (project mode only)
    if (!this.isGlobal) {
      this.lockManager.remove(name);
    }

    // Remove from skills.json (project mode only)
    if (!this.isGlobal && this.config.exists()) {
      this.config.removeSkill(name);
    }

    const locationHint = this.isGlobal ? '(global)' : '';
    logger.success(`Uninstalled ${name} ${locationHint}`.trim());
    return true;
  }

  /**
   * Check if a skill needs to be updated by comparing local and remote commits
   *
   * @param name - Skill name
   * @param remoteCommit - Remote commit hash to compare against
   * @returns true if update is needed, false if already up to date
   */
  checkNeedsUpdate(name: string, remoteCommit: string): boolean {
    const locked = this.lockManager.get(name);

    // No lock info or no commit hash means we need to update
    if (!locked?.commit) {
      return true;
    }

    // Compare commits
    return locked.commit !== remoteCommit;
  }

  /**
   * Update skill
   */
  async update(name?: string): Promise<InstalledSkill[]> {
    const updated: InstalledSkill[] = [];

    if (name) {
      // Update single skill
      const ref = this.config.getSkillRef(name);
      if (!ref) {
        logger.error(`Skill ${name} not found in skills.json`);
        return [];
      }

      // Check if update is needed by getting remote commit first
      const resolved = await this.resolver.resolve(ref);
      const remoteCommit = await this.cache.getRemoteCommit(resolved.repoUrl, resolved.ref);

      if (!this.checkNeedsUpdate(name, remoteCommit)) {
        logger.info(`${name} is already up to date`);
        return [];
      }

      const skill = await this.install(ref, { force: true, save: false });
      updated.push(skill);
    } else {
      // Update all
      const skills = this.config.getSkills();
      for (const [skillName, ref] of Object.entries(skills)) {
        try {
          // Check if update is needed
          const resolved = await this.resolver.resolve(ref);
          const remoteCommit = await this.cache.getRemoteCommit(resolved.repoUrl, resolved.ref);

          if (!this.checkNeedsUpdate(skillName, remoteCommit)) {
            logger.info(`${skillName} is already up to date`);
            continue;
          }

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
   * List installed skills
   *
   * Checks both canonical (.agents/skills/) and legacy (.skills/) locations.
   */
  list(): InstalledSkill[] {
    const skills: InstalledSkill[] = [];
    const seenNames = new Set<string>();

    // Check canonical location first (.agents/skills/)
    const canonicalDir = this.getCanonicalSkillsDir();
    if (exists(canonicalDir)) {
      for (const name of listDir(canonicalDir)) {
        const skillPath = path.join(canonicalDir, name);
        if (!isDirectory(skillPath)) {
          continue;
        }

        const skill = this.getInstalledSkillFromPath(name, skillPath);
        if (skill) {
          skills.push(skill);
          seenNames.add(name);
        }
      }
    }

    // Check legacy location (.skills/)
    const legacyDir = this.getInstallDir();
    if (exists(legacyDir) && legacyDir !== canonicalDir) {
      for (const name of listDir(legacyDir)) {
        // Skip if already found in canonical location
        if (seenNames.has(name)) {
          continue;
        }

        const skillPath = path.join(legacyDir, name);
        if (!isDirectory(skillPath)) {
          continue;
        }

        // Skip symlinks pointing to canonical location (avoid duplicates)
        if (isSymlink(skillPath)) {
          try {
            const realPath = getRealPath(skillPath);
            if (realPath.includes(path.join('.agents', 'skills'))) {
              continue;
            }
          } catch {
            // If we can't resolve the symlink, include it anyway
          }
        }

        const skill = this.getInstalledSkillFromPath(name, skillPath);
        if (skill) {
          skills.push(skill);
          seenNames.add(name);
        }
      }
    }

    return skills;
  }

  /**
   * Get installed skill information from a specific path
   */
  private getInstalledSkillFromPath(name: string, skillPath: string): InstalledSkill | null {
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
        // Ignore parse errors
      }
    }

    return {
      name,
      path: skillPath,
      version: isLinked ? 'local' : locked?.version || metadata?.version || 'unknown',
      source: isLinked ? getRealPath(skillPath) : locked?.source || '',
      metadata,
      isLinked,
    };
  }

  /**
   * Get installed skill information
   *
   * Checks canonical location first, then legacy location.
   */
  getInstalledSkill(name: string): InstalledSkill | null {
    // Check canonical location first (.agents/skills/)
    const canonicalPath = path.join(this.getCanonicalSkillsDir(), name);
    if (exists(canonicalPath)) {
      return this.getInstalledSkillFromPath(name, canonicalPath);
    }

    // Check legacy location (.skills/)
    const legacyPath = path.join(this.getInstallDir(), name);
    if (exists(legacyPath)) {
      return this.getInstalledSkillFromPath(name, legacyPath);
    }

    return null;
  }

  /**
   * Get skill details
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
   * Check for outdated skills
   */
  async checkOutdated(): Promise<
    Array<{
      name: string;
      current: string;
      latest: string;
      updateAvailable: boolean;
    }>
  > {
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
        // Use ref for comparison (git tag/branch/commit), fallback to version for backward compatibility
        const currentRef = locked?.ref || locked?.version || 'unknown';
        const currentVersion = locked?.version || 'unknown';

        // Parse latest version
        const parsed = this.resolver.parseRef(ref);
        const repoUrl = this.resolver.buildRepoUrl(parsed);

        // Force get latest
        const latestResolved = await this.resolver.resolveVersion(repoUrl, {
          type: 'latest',
          value: 'latest',
          raw: 'latest',
        });

        const latest = latestResolved.ref;
        // Compare using git refs, not semantic versions
        const updateAvailable = currentRef !== latest && currentRef !== 'unknown';

        results.push({
          name,
          current: currentVersion !== currentRef ? `${currentVersion} (${currentRef})` : currentRef,
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
  // Multi-Agent installation methods
  // ============================================================================

  /**
   * Install skill to multiple agents
   *
   * @param ref - Skill reference (e.g., github:user/repo@v1.0.0)
   * @param targetAgents - Target agents list
   * @param options - Installation options
   */
  async installToAgents(
    ref: string,
    targetAgents: AgentType[],
    options: InstallOptions = {},
  ): Promise<{
    skill: InstalledSkill;
    results: Map<AgentType, InstallResult>;
  }> {
    const { save = true, mode = 'symlink' } = options;

    // Parse reference
    const resolved = await this.resolver.resolve(ref);
    const { parsed, repoUrl } = resolved;
    const gitRef = resolved.ref; // Git reference (tag, branch, commit)
    const skillName = parsed.subPath ? path.basename(parsed.subPath) : parsed.repo;

    logger.package(`Installing ${skillName}@${gitRef} to ${targetAgents.length} agent(s)...`);

    // Check cache
    let cacheResult = await this.cache.get(parsed, gitRef);

    if (!cacheResult) {
      logger.debug(`Caching ${skillName}@${gitRef} from ${repoUrl}`);
      cacheResult = await this.cache.cache(repoUrl, parsed, gitRef, gitRef);
    } else {
      logger.debug(`Using cached ${skillName}@${gitRef}`);
    }

    // Get cache path as source
    const sourcePath = this.cache.getCachePath(parsed, gitRef);

    // Read semantic version from skill.json
    let semanticVersion = gitRef; // fallback to gitRef if no skill.json
    const skillJsonPath = path.join(sourcePath, 'skill.json');
    if (exists(skillJsonPath)) {
      try {
        const skillJson = readJson<SkillJson>(skillJsonPath);
        if (skillJson.version) {
          semanticVersion = skillJson.version;
        }
      } catch {
        // Ignore parse errors, use gitRef as fallback
      }
    }

    // Create Installer
    const installer = new Installer({
      cwd: this.projectRoot,
      global: this.isGlobal,
    });

    // Install to all target agents
    const results = await installer.installToAgents(sourcePath, skillName, targetAgents, {
      mode: mode as InstallMode,
    });

    // Update lock file (project mode only)
    if (!this.isGlobal) {
      this.lockManager.lockSkill(skillName, {
        source: `${parsed.registry}:${parsed.owner}/${parsed.repo}${parsed.subPath ? `/${parsed.subPath}` : ''}`,
        version: semanticVersion,
        ref: gitRef,
        resolved: repoUrl,
        commit: cacheResult.commit,
      });
    }

    // Update skills.json (project mode only)
    if (!this.isGlobal && save) {
      this.config.ensureExists();
      this.config.addSkill(skillName, ref);
    }

    // Count results
    const successCount = Array.from(results.values()).filter((r) => r.success).length;
    const failCount = results.size - successCount;

    const displayVersion = semanticVersion !== gitRef ? `${semanticVersion} (${gitRef})` : gitRef;
    if (failCount === 0) {
      logger.success(`Installed ${skillName}@${displayVersion} to ${successCount} agent(s)`);
    } else {
      logger.warn(
        `Installed ${skillName}@${displayVersion} to ${successCount} agent(s), ${failCount} failed`,
      );
    }

    // Build the InstalledSkill to return
    const skill: InstalledSkill = {
      name: skillName,
      path: sourcePath,
      version: semanticVersion,
      source: `${parsed.registry}:${parsed.owner}/${parsed.repo}${parsed.subPath ? `/${parsed.subPath}` : ''}`,
    };

    return { skill, results };
  }

  /**
   * Get default target agents
   *
   * Priority:
   * 1. defaults.targetAgents in skills.json
   * 2. Auto-detect installed agents
   * 3. Return empty array
   */
  async getDefaultTargetAgents(): Promise<AgentType[]> {
    // Read from configuration
    const defaults = this.config.getDefaults();
    if (defaults.targetAgents && defaults.targetAgents.length > 0) {
      return defaults.targetAgents.filter(isValidAgentType) as AgentType[];
    }

    // Auto-detect
    return detectInstalledAgents();
  }

  /**
   * Get default installation mode
   */
  getDefaultInstallMode(): InstallMode {
    const defaults = this.config.getDefaults();
    if (defaults.installMode === 'copy' || defaults.installMode === 'symlink') {
      return defaults.installMode;
    }
    return 'symlink';
  }

  /**
   * Validate agent type list
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
   * Get all available agent types
   */
  getAllAgentTypes(): AgentType[] {
    return Object.keys(agents) as AgentType[];
  }

  /**
   * Uninstall skill from specified agents
   */
  uninstallFromAgents(name: string, targetAgents: AgentType[]): Map<AgentType, boolean> {
    const installer = new Installer({
      cwd: this.projectRoot,
      global: this.isGlobal,
    });

    const results = installer.uninstallFromAgents(name, targetAgents);

    // Remove from lock file (project mode only)
    if (!this.isGlobal) {
      this.lockManager.remove(name);
    }

    // Remove from skills.json (project mode only)
    if (!this.isGlobal && this.config.exists()) {
      this.config.removeSkill(name);
    }

    const successCount = Array.from(results.values()).filter((r) => r).length;
    logger.success(`Uninstalled ${name} from ${successCount} agent(s)`);

    return results;
  }
}

export default SkillManager;
