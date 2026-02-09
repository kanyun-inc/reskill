import * as path from 'node:path';
import type { InstalledSkill, InstallOptions, SkillInfo } from '../types/index.js';
import {
  ensureDir,
  exists,
  getGlobalSkillsDir,
  getRealPath,
  isDirectory,
  isSymlink,
  listDir,
  remove,
} from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { getRegistryUrl, getShortName, parseSkillIdentifier } from '../utils/registry-scope.js';
import {
  type AgentType,
  agents,
  detectInstalledAgents,
  isValidAgentType,
} from './agent-registry.js';
import { CacheManager } from './cache-manager.js';
import { ConfigLoader } from './config-loader.js';
import { GitResolver } from './git-resolver.js';
import { HttpResolver } from './http-resolver.js';
import { Installer, type InstallMode, type InstallResult } from './installer.js';
import { LockManager } from './lock-manager.js';
import { RegistryClient, RegistryError } from './registry-client.js';
import { RegistryResolver } from './registry-resolver.js';
import {
  discoverSkillsInDir,
  filterSkillsByName,
  type ParsedSkillWithPath,
  parseSkillFromDir,
} from './skill-parser.js';

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
  private httpResolver: HttpResolver;
  private registryResolver: RegistryResolver;
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
    // Pass registry resolver from ConfigLoader to GitResolver
    this.resolver = new GitResolver('github', undefined, (registryName: string) =>
      this.config.getRegistryUrl(registryName),
    );
    this.httpResolver = new HttpResolver();
    this.registryResolver = new RegistryResolver();
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
   * Checks canonical location first, then falls back to configured installDir.
   */
  getSkillPath(name: string): string {
    // Check canonical location first (.agents/skills/)
    const canonicalPath = path.join(this.getCanonicalSkillsDir(), name);
    if (exists(canonicalPath)) {
      return canonicalPath;
    }

    // Check configured installation directory (.skills/ or custom)
    const installDir = this.getInstallDir();
    const installPath = path.join(installDir, name);
    if (exists(installPath)) {
      return installPath;
    }

    // Default to configured installation directory for new installations
    // if it's not the default .skills, otherwise use canonical location.
    // This respects "installDir" in skills.json.
    const defaults = this.config.getDefaults();
    if (defaults.installDir !== '.skills' && !this.isGlobal) {
      return installPath;
    }

    // Default to canonical location for new installations
    return canonicalPath;
  }

  /**
   * Detect if a reference is an HTTP/OSS URL
   */
  private isHttpSource(ref: string): boolean {
    return HttpResolver.isHttpUrl(ref);
  }

  /**
   * Detect if a reference is a registry source (@scope/name or name@version)
   */
  private isRegistrySource(ref: string): boolean {
    return RegistryResolver.isRegistryRef(ref);
  }

  /**
   * Get skill metadata from SKILL.md in a directory
   *
   * @param dirPath - Path to the skill directory
   * @returns Skill metadata (name, version, description) or null if not found
   */
  private getSkillMetadataFromDir(dirPath: string): {
    name: string;
    version?: string;
    description?: string;
  } | null {
    try {
      const skill = parseSkillFromDir(dirPath);
      if (skill?.name) {
        return {
          name: skill.name,
          version: skill.version,
          description: skill.description,
        };
      }
    } catch (error) {
      logger.debug(`Failed to parse SKILL.md in ${dirPath}: ${(error as Error).message}`);
    }
    return null;
  }

  /**
   * Install skill
   */
  async install(ref: string, options: InstallOptions = {}): Promise<InstalledSkill> {
    // Detect source type and delegate to appropriate installer
    if (this.isHttpSource(ref)) {
      return this.installFromHttp(ref, options);
    }
    return this.installFromGit(ref, options);
  }

  /**
   * Install skill from Git repository
   */
  private async installFromGit(ref: string, options: InstallOptions = {}): Promise<InstalledSkill> {
    const { force = false, save = true } = options;

    // Parse reference
    const resolved = await this.resolver.resolve(ref);
    const { parsed, repoUrl } = resolved;
    const gitRef = resolved.ref; // Git reference (tag, branch, commit)
    // Fallback name from path/repo (will be overridden by SKILL.md name if available)
    const fallbackName = parsed.subPath ? path.basename(parsed.subPath) : parsed.repo;

    // Cache first - we need to read SKILL.md to get the real name
    let cacheResult = await this.cache.get(parsed, gitRef);

    if (!cacheResult) {
      logger.debug(`Caching from ${repoUrl}@${gitRef}`);
      cacheResult = await this.cache.cache(repoUrl, parsed, gitRef, gitRef);
    }

    // Get the real skill name from SKILL.md in cache
    const cachePath = this.cache.getCachePath(parsed, gitRef);
    const metadata = this.getSkillMetadataFromDir(cachePath);
    const skillName = metadata?.name ?? fallbackName;
    const semanticVersion = metadata?.version ?? gitRef;

    const skillPath = this.getSkillPath(skillName);

    // Check if already installed (using the real name from SKILL.md)
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

    // Copy to installation directory
    ensureDir(this.getInstallDir());

    if (exists(skillPath)) {
      remove(skillPath);
    }

    await this.cache.copyTo(parsed, gitRef, skillPath);

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
      // Normalize the reference to use registry shorthand if possible
      const normalizedRef = this.config.normalizeSkillRef(ref);
      this.config.addSkill(skillName, normalizedRef);
    }

    const displayVersion = semanticVersion !== gitRef ? `${semanticVersion} (${gitRef})` : gitRef;
    const locationHint = this.isGlobal ? '(global)' : '';
    logger.success(
      `Installed ${skillName}@${displayVersion} to ${skillPath} ${locationHint}`.trim(),
    );

    const installed = this.getInstalledSkill(skillName);
    if (!installed) {
      throw new Error(`Failed to get installed skill info for ${skillName}`);
    }
    return installed;
  }

  /**
   * Install skill from HTTP/OSS URL
   */
  private async installFromHttp(
    ref: string,
    options: InstallOptions = {},
  ): Promise<InstalledSkill> {
    const { force = false, save = true } = options;

    // Parse HTTP reference
    const resolved = await this.httpResolver.resolve(ref);
    const { parsed, repoUrl, httpInfo } = resolved;
    const version = resolved.ref || 'latest';
    // Fallback name from URL (will be overridden by SKILL.md name if available)
    const fallbackName = httpInfo.skillName;

    // Cache first - we need to read SKILL.md to get the real name
    let cacheResult = await this.cache.get(parsed, version);

    if (!cacheResult) {
      logger.debug(`Downloading from ${repoUrl}`);
      cacheResult = await this.cache.cacheFromHttp(repoUrl, parsed, version);
    }

    // Get the real skill name from SKILL.md in cache
    const cachePath = this.cache.getCachePath(parsed, version);
    const metadata = this.getSkillMetadataFromDir(cachePath);
    const skillName = metadata?.name ?? fallbackName;
    const semanticVersion = metadata?.version ?? version;

    const skillPath = this.getSkillPath(skillName);

    // Check if already installed (using the real name from SKILL.md)
    if (exists(skillPath) && !force) {
      const locked = this.lockManager.get(skillName);
      const lockedRef = locked?.ref || locked?.version;
      if (locked && lockedRef === version) {
        logger.info(`${skillName}@${version} is already installed`);
        const installed = this.getInstalledSkill(skillName);
        if (installed) return installed;
      }

      if (!force) {
        logger.warn(`${skillName} is already installed. Use --force to reinstall.`);
        const installed = this.getInstalledSkill(skillName);
        if (installed) return installed;
      }
    }

    logger.package(`Installing ${skillName}@${version} from ${httpInfo.host}...`);

    // Copy to installation directory
    ensureDir(this.getInstallDir());

    if (exists(skillPath)) {
      remove(skillPath);
    }

    await this.cache.copyTo(parsed, version, skillPath);

    // Update lock file (project mode only)
    if (!this.isGlobal) {
      this.lockManager.lockSkill(skillName, {
        source: `http:${httpInfo.host}/${skillName}`,
        version: semanticVersion,
        ref: version,
        resolved: repoUrl,
        commit: cacheResult.commit,
      });
    }

    // Update skills.json (project mode only)
    if (!this.isGlobal && save) {
      this.config.ensureExists();
      this.config.addSkill(skillName, ref);
    }

    const displayVersion =
      semanticVersion !== version ? `${semanticVersion} (${version})` : version;
    const locationHint = this.isGlobal ? '(global)' : '';
    logger.success(
      `Installed ${skillName}@${displayVersion} to ${skillPath} ${locationHint}`.trim(),
    );

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

      // Check if update is needed (skip check for HTTP sources - always re-download)
      if (!this.isHttpSource(ref)) {
        const resolved = await this.resolver.resolve(ref);
        const remoteCommit = await this.cache.getRemoteCommit(resolved.repoUrl, resolved.ref);

        if (!this.checkNeedsUpdate(name, remoteCommit)) {
          logger.info(`${name} is already up to date`);
          return [];
        }
      } else {
        // For HTTP sources, log that we're re-downloading
        logger.info(`${name} is from HTTP source, re-downloading...`);
      }

      const skill = await this.install(ref, { force: true, save: false });
      updated.push(skill);
    } else {
      // Update all
      const skills = this.config.getSkills();
      for (const [skillName, ref] of Object.entries(skills)) {
        try {
          // Check if update is needed (skip check for HTTP sources)
          if (!this.isHttpSource(ref)) {
            const resolved = await this.resolver.resolve(ref);
            const remoteCommit = await this.cache.getRemoteCommit(resolved.repoUrl, resolved.ref);

            if (!this.checkNeedsUpdate(skillName, remoteCommit)) {
              logger.info(`${skillName} is already up to date`);
              continue;
            }
          } else {
            logger.info(`${skillName} is from HTTP source, re-downloading...`);
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

    // Read metadata from SKILL.md (sole source per agentskills.io spec)
    const skillMd = this.getSkillMetadataFromDir(skillPath);

    // Version priority: locked > SKILL.md > 'unknown'
    const version = isLinked ? 'local' : locked?.version || skillMd?.version || 'unknown';

    return {
      name,
      path: skillPath,
      version,
      source: isLinked ? getRealPath(skillPath) : locked?.source || '',
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

        // HTTP sources don't support version checking
        if (this.isHttpSource(ref)) {
          results.push({
            name,
            current: currentVersion,
            latest: 'n/a (HTTP source)',
            updateAvailable: false,
          });
          continue;
        }

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
   * @param ref - Skill reference (e.g., github:user/repo@v1.0.0 or HTTP URL)
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
    // Detect source type and delegate to appropriate installer
    // Priority: Registry > HTTP > Git (registry first, as its format is most constrained)
    if (this.isRegistrySource(ref)) {
      return this.installToAgentsFromRegistry(ref, targetAgents, options);
    }
    if (this.isHttpSource(ref)) {
      return this.installToAgentsFromHttp(ref, targetAgents, options);
    }
    return this.installToAgentsFromGit(ref, targetAgents, options);
  }

  /**
   * Multi-skill install: discover skills in a Git repo and install selected ones (or list only).
   * Only Git references are supported (including https://github.com/...); registry refs are not.
   *
   * @param ref - Git skill reference (e.g. github:user/repo@v1.0.0 or https://github.com/user/repo); any #fragment is stripped for resolution
   * @param skillNames - If non-empty, install only these skills (by SKILL.md name). If empty and !listOnly, install all.
   * @param targetAgents - Target agents
   * @param options - Install options; listOnly: true means discover and return skills without installing
   */
  async installSkillsFromRepo(
    ref: string,
    skillNames: string[],
    targetAgents: AgentType[],
    options: InstallOptions & { listOnly?: boolean } = {},
  ): Promise<
    | { listOnly: true; skills: ParsedSkillWithPath[] }
    | {
        listOnly: false;
        installed: Array<{
          skill: InstalledSkill;
          results: Map<AgentType, InstallResult>;
        }>;
        skipped: Array<{ name: string; reason: string }>;
      }
  > {
    const { listOnly = false, force = false, save = true, mode = 'symlink' } = options;

    const refForResolve = ref.replace(/#.*$/, '').trim();
    const resolved = await this.resolver.resolve(refForResolve);
    const { parsed, repoUrl } = resolved;
    const gitRef = resolved.ref;

    let cacheResult = await this.cache.get(parsed, gitRef);
    if (!cacheResult) {
      logger.debug(`Caching from ${repoUrl}@${gitRef}`);
      cacheResult = await this.cache.cache(repoUrl, parsed, gitRef, gitRef);
    }

    const cachePath = this.cache.getCachePath(parsed, gitRef);
    const discovered = discoverSkillsInDir(cachePath);

    if (discovered.length === 0) {
      throw new Error(
        'No valid skills found. Skills require a SKILL.md with name and description.',
      );
    }

    if (listOnly) {
      return { listOnly: true, skills: discovered };
    }

    const selected =
      skillNames.length > 0 ? filterSkillsByName(discovered, skillNames) : discovered;

    if (skillNames.length > 0 && selected.length === 0) {
      const available = discovered.map((s) => s.name).join(', ');
      throw new Error(
        `No matching skills found for: ${skillNames.join(', ')}. Available skills: ${available}`,
      );
    }

    const baseRefForSave = this.config.normalizeSkillRef(refForResolve);
    const defaults = this.config.getDefaults();
    // Only pass custom installDir to Installer; default '.skills' should use
    // the Installer's built-in canonical path (.agents/skills/)
    const customInstallDir = defaults.installDir !== '.skills' ? defaults.installDir : undefined;
    const installer = new Installer({
      cwd: this.projectRoot,
      global: this.isGlobal,
      installDir: customInstallDir,
    });

    const installed: Array<{
      skill: InstalledSkill;
      results: Map<AgentType, InstallResult>;
    }> = [];
    const skipped: Array<{ name: string; reason: string }> = [];

    const skillSource = `${parsed.registry}:${parsed.owner}/${parsed.repo}${parsed.subPath ? `/${parsed.subPath}` : ''}`;

    for (const skillInfo of selected) {
      const semanticVersion = skillInfo.version ?? gitRef;

      // Skip already-installed skills unless --force is set
      if (!force) {
        const existingSkill = this.getInstalledSkill(skillInfo.name);
        if (existingSkill) {
          const locked = this.lockManager.get(skillInfo.name);
          const lockedRef = locked?.ref || locked?.version;
          if (lockedRef === gitRef) {
            const reason = `already installed at ${gitRef}`;
            logger.info(`${skillInfo.name}@${gitRef} is already installed, skipping`);
            skipped.push({ name: skillInfo.name, reason });
            continue;
          }
          // Different version installed — allow upgrade without --force
          // Only skip when the exact same ref is already locked
        }
      }

      logger.package(
        `Installing ${skillInfo.name}@${gitRef} to ${targetAgents.length} agent(s)...`,
      );

      // Note: force is handled at the SkillManager level (skip-if-installed check above).
      // The Installer always overwrites (remove + copy), so no force flag is needed there.
      const results = await installer.installToAgents(
        skillInfo.dirPath,
        skillInfo.name,
        targetAgents,
        { mode: mode as InstallMode },
      );

      if (!this.isGlobal) {
        this.lockManager.lockSkill(skillInfo.name, {
          source: skillSource,
          version: semanticVersion,
          ref: gitRef,
          resolved: repoUrl,
          commit: cacheResult.commit,
        });
      }

      if (!this.isGlobal && save) {
        this.config.ensureExists();
        this.config.addSkill(skillInfo.name, `${baseRefForSave}#${skillInfo.name}`);
      }

      const successCount = Array.from(results.values()).filter((r) => r.success).length;
      logger.success(`Installed ${skillInfo.name}@${semanticVersion} to ${successCount} agent(s)`);

      installed.push({
        skill: {
          name: skillInfo.name,
          path: skillInfo.dirPath,
          version: semanticVersion,
          source: skillSource,
        },
        results,
      });
    }

    return { listOnly: false, installed, skipped };
  }

  /**
   * Install skill from Git to multiple agents
   */
  private async installToAgentsFromGit(
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
    // Fallback name from path/repo (will be overridden by SKILL.md name if available)
    const fallbackName = parsed.subPath ? path.basename(parsed.subPath) : parsed.repo;

    // Cache first - we need to read SKILL.md to get the real name
    let cacheResult = await this.cache.get(parsed, gitRef);

    if (!cacheResult) {
      logger.debug(`Caching from ${repoUrl}@${gitRef}`);
      cacheResult = await this.cache.cache(repoUrl, parsed, gitRef, gitRef);
    }

    // Get cache path as source
    const sourcePath = this.cache.getCachePath(parsed, gitRef);

    // Get the real skill name from SKILL.md in cache
    const metadata = this.getSkillMetadataFromDir(sourcePath);
    const skillName = metadata?.name ?? fallbackName;
    const semanticVersion = metadata?.version ?? gitRef;

    logger.package(`Installing ${skillName}@${gitRef} to ${targetAgents.length} agent(s)...`);

    // Create Installer with custom installDir from config
    const defaults = this.config.getDefaults();
    const installer = new Installer({
      cwd: this.projectRoot,
      global: this.isGlobal,
      installDir: defaults.installDir,
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
      // Normalize the reference to use registry shorthand if possible
      const normalizedRef = this.config.normalizeSkillRef(ref);
      this.config.addSkill(skillName, normalizedRef);
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
   * Install skill from HTTP/OSS to multiple agents
   */
  private async installToAgentsFromHttp(
    ref: string,
    targetAgents: AgentType[],
    options: InstallOptions = {},
  ): Promise<{
    skill: InstalledSkill;
    results: Map<AgentType, InstallResult>;
  }> {
    const { save = true, mode = 'symlink' } = options;

    // Parse HTTP reference
    const resolved = await this.httpResolver.resolve(ref);
    const { parsed, repoUrl, httpInfo } = resolved;
    const version = resolved.ref || 'latest';
    // Fallback name from URL (will be overridden by SKILL.md name if available)
    const fallbackName = httpInfo.skillName;

    // Cache first - we need to read SKILL.md to get the real name
    let cacheResult = await this.cache.get(parsed, version);

    if (!cacheResult) {
      logger.debug(`Downloading from ${repoUrl}`);
      cacheResult = await this.cache.cacheFromHttp(repoUrl, parsed, version);
    }

    // Get cache path as source
    const sourcePath = this.cache.getCachePath(parsed, version);

    // Get the real skill name from SKILL.md in cache
    const metadata = this.getSkillMetadataFromDir(sourcePath);
    const skillName = metadata?.name ?? fallbackName;
    const semanticVersion = metadata?.version ?? version;

    logger.package(
      `Installing ${skillName}@${version} from ${httpInfo.host} to ${targetAgents.length} agent(s)...`,
    );

    // Create Installer with custom installDir from config
    const defaults = this.config.getDefaults();
    const installer = new Installer({
      cwd: this.projectRoot,
      global: this.isGlobal,
      installDir: defaults.installDir,
    });

    // Install to all target agents
    const results = await installer.installToAgents(sourcePath, skillName, targetAgents, {
      mode: mode as InstallMode,
    });

    // Update lock file (project mode only)
    if (!this.isGlobal) {
      this.lockManager.lockSkill(skillName, {
        source: `http:${httpInfo.host}/${skillName}`,
        version: semanticVersion,
        ref: version,
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

    const displayVersion =
      semanticVersion !== version ? `${semanticVersion} (${version})` : version;
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
      source: `http:${httpInfo.host}/${skillName}`,
    };

    return { skill, results };
  }

  /**
   * Install skill from npm-style Registry to multiple agents
   *
   * Supports:
   * - Private registry: @scope/name[@version] (e.g., @kanyun/planning-with-files@2.4.5)
   * - Public registry: name[@version] (e.g., my-skill@1.0.0)
   * - Web-published skills (github/gitlab/oss_url/custom_url/local)
   */
  private async installToAgentsFromRegistry(
    ref: string,
    targetAgents: AgentType[],
    options: InstallOptions = {},
  ): Promise<{
    skill: InstalledSkill;
    results: Map<AgentType, InstallResult>;
  }> {
    const { force = false, save = true, mode = 'symlink' } = options;

    // Parse skill identifier and resolve registry URL once (single source of truth)
    const parsed = parseSkillIdentifier(ref);
    const registryUrl = options.registry || getRegistryUrl(parsed.scope);
    const client = new RegistryClient({ registry: registryUrl });

    // Query skill info to determine source_type
    let skillInfo: SkillInfo;
    try {
      skillInfo = await client.getSkillInfo(parsed.fullName);
    } catch (error) {
      // Only handle 404 (skill not found) - re-throw other errors (network, server, parsing)
      if (error instanceof RegistryError && error.statusCode === 404) {
        skillInfo = { name: parsed.fullName };
      } else {
        throw error;
      }
    }

    // Branch based on source_type (pass resolved registryUrl via options to avoid re-computation)
    const sourceType = skillInfo.source_type;
    if (sourceType && sourceType !== 'registry') {
      return this.installFromWebPublished(skillInfo, parsed, targetAgents, {
        ...options,
        registry: registryUrl,
      });
    }

    // 1. Resolve registry skill (pass pre-resolved registryUrl)
    logger.package(`Resolving ${ref} from registry...`);
    const resolved = await this.registryResolver.resolve(ref, registryUrl);
    const {
      shortName,
      version,
      registryUrl: resolvedRegistryUrl,
      tarball,
      parsed: resolvedParsed,
    } = resolved;

    // 2. Check if already installed (skip if --force)
    const skillPath = this.getSkillPath(shortName);
    if (exists(skillPath) && !force) {
      const locked = this.lockManager.get(shortName);
      const lockedVersion = locked?.version;

      // Same version already installed
      if (locked && lockedVersion === version) {
        logger.info(`${shortName}@${version} is already installed.`);
        const installed = this.getInstalledSkill(shortName);
        if (installed) {
          return {
            skill: installed,
            results: new Map(
              targetAgents.map((a) => [
                a,
                { success: true, path: skillPath, mode: mode as InstallMode },
              ]),
            ),
          };
        }
      }

      // Different version or no lock info - warn user
      logger.warn(`${shortName} is already installed. Use --force to reinstall.`);
      const installed = this.getInstalledSkill(shortName);
      if (installed) {
        return {
          skill: installed,
          results: new Map(
            targetAgents.map((a) => [
              a,
              { success: true, path: skillPath, mode: mode as InstallMode },
            ]),
          ),
        };
      }
    }

    logger.package(
      `Installing ${shortName}@${version} from ${resolvedRegistryUrl} to ${targetAgents.length} agent(s)...`,
    );

    // 3. Create temp directory for extraction (clean stale files first)
    const tempDir = path.join(this.cache.getCacheDir(), 'registry-temp', `${shortName}-${version}`);
    await remove(tempDir);
    await ensureDir(tempDir);

    try {
      // 4. Extract tarball
      const extractedPath = await this.registryResolver.extract(tarball, tempDir);
      logger.debug(`Extracted to ${extractedPath}`);

      // 5. Create Installer with custom installDir from config
      const defaults = this.config.getDefaults();
      const installer = new Installer({
        cwd: this.projectRoot,
        global: this.isGlobal,
        installDir: defaults.installDir,
      });

      // 6. Install to all target agents
      const results = await installer.installToAgents(extractedPath, shortName, targetAgents, {
        mode: mode as InstallMode,
      });

      // 7. Update lock file (project mode only)
      if (!this.isGlobal) {
        this.lockManager.lockSkill(shortName, {
          source: `registry:${resolvedParsed.fullName}`,
          version,
          ref: version,
          resolved: resolvedRegistryUrl,
          commit: resolved.integrity, // Use integrity as commit-like identifier
        });
      }

      // 8. Update skills.json (project mode only)
      if (!this.isGlobal && save) {
        this.config.ensureExists();
        // Save with full name for registry skills
        this.config.addSkill(shortName, ref);
      }

      // 9. Count results and log
      const successCount = Array.from(results.values()).filter((r) => r.success).length;
      const failCount = results.size - successCount;

      if (failCount === 0) {
        logger.success(`Installed ${shortName}@${version} to ${successCount} agent(s)`);
      } else {
        logger.warn(
          `Installed ${shortName}@${version} to ${successCount} agent(s), ${failCount} failed`,
        );
      }

      // 10. Build the InstalledSkill to return
      const skill: InstalledSkill = {
        name: shortName,
        path: extractedPath,
        version,
        source: `registry:${resolvedParsed.fullName}`,
      };

      return { skill, results };
    } finally {
      // Clean up temp directory after installation
      await remove(tempDir);
    }
  }

  // ============================================================================
  // Web-published skill installation
  // ============================================================================

  /**
   * Install a web-published skill.
   *
   * Web-published skills do not support versioning. Branches to different
   * installation logic based on source_type:
   * - github/gitlab: reuses installToAgentsFromGit
   * - oss_url/custom_url: reuses installToAgentsFromHttp
   * - local: downloads tarball via Registry API
   */
  private async installFromWebPublished(
    skillInfo: SkillInfo,
    parsed: ReturnType<typeof parseSkillIdentifier>,
    targetAgents: AgentType[],
    options: InstallOptions = {},
  ): Promise<{
    skill: InstalledSkill;
    results: Map<AgentType, InstallResult>;
  }> {
    const { source_type, source_url } = skillInfo;

    // Web-published skills do not support version specifiers
    if (parsed.version && parsed.version !== 'latest') {
      throw new Error(
        `Version specifier not supported for web-published skills.\n` +
          `'${parsed.fullName}' was published via web and does not support versioning.\n` +
          `Use: reskill install ${parsed.fullName}`,
      );
    }

    if (!source_url) {
      throw new Error(`Missing source_url for web-published skill: ${parsed.fullName}`);
    }

    logger.package(`Installing ${parsed.fullName} from ${source_type} source...`);

    switch (source_type) {
      case 'github':
      case 'gitlab':
        // source_url is a full Git URL (includes ref and path)
        // Reuse existing Git installation logic
        return this.installToAgentsFromGit(source_url, targetAgents, options);

      case 'oss_url':
      case 'custom_url':
        // Direct download URL
        return this.installToAgentsFromHttp(source_url, targetAgents, options);

      case 'local':
        // Download tarball via Registry API
        return this.installFromRegistryLocal(parsed, targetAgents, options);

      default:
        throw new Error(`Unknown source_type: ${source_type}`);
    }
  }

  /**
   * Install a skill published via "local folder" mode.
   *
   * Downloads tarball via RegistryClient (handles 302 redirects to signed OSS URLs),
   * then extracts and installs using the same flow as registry source_type.
   */
  private async installFromRegistryLocal(
    parsed: ReturnType<typeof parseSkillIdentifier>,
    targetAgents: AgentType[],
    options: InstallOptions = {},
  ): Promise<{
    skill: InstalledSkill;
    results: Map<AgentType, InstallResult>;
  }> {
    const { save = true, mode = 'symlink' } = options;
    const registryUrl = options.registry || getRegistryUrl(parsed.scope);
    const shortName = getShortName(parsed.fullName);
    const version = 'latest';

    // Download tarball via RegistryClient (handles auth + 302 redirect to signed URL)
    const client = new RegistryClient({ registry: registryUrl });
    const { tarball } = await client.downloadSkill(parsed.fullName, version);

    logger.package(
      `Installing ${shortName} from ${registryUrl} to ${targetAgents.length} agent(s)...`,
    );

    // Extract tarball to temp directory (clean stale files first)
    const tempDir = path.join(this.cache.getCacheDir(), 'registry-temp', `${shortName}-${version}`);
    await remove(tempDir);
    await ensureDir(tempDir);

    try {
      const extractedPath = await this.registryResolver.extract(tarball, tempDir);
      logger.debug(`Extracted to ${extractedPath}`);

      // Install to all target agents
      const defaults = this.config.getDefaults();
      const installer = new Installer({
        cwd: this.projectRoot,
        global: this.isGlobal,
        installDir: defaults.installDir,
      });
      const results = await installer.installToAgents(extractedPath, shortName, targetAgents, {
        mode: mode as InstallMode,
      });

      // Get metadata from extracted path
      const metadata = this.getSkillMetadataFromDir(extractedPath);
      const skillName = metadata?.name ?? shortName;
      const semanticVersion = metadata?.version ?? version;

      // Update lock file (project mode only)
      if (!this.isGlobal) {
        this.lockManager.lockSkill(skillName, {
          source: `registry:${parsed.fullName}`,
          version: semanticVersion,
          ref: version,
          resolved: registryUrl,
          commit: '', // Local-published skills have no commit hash
        });
      }

      // Update skills.json (project mode only)
      if (!this.isGlobal && save) {
        this.config.ensureExists();
        this.config.addSkill(skillName, parsed.fullName);
      }

      return {
        skill: {
          name: skillName,
          path: extractedPath,
          version: semanticVersion,
          source: `registry:${parsed.fullName}`,
        },
        results,
      };
    } finally {
      // Clean up temp directory after installation
      await remove(tempDir);
    }
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
    const defaults = this.config.getDefaults();
    const installer = new Installer({
      cwd: this.projectRoot,
      global: this.isGlobal,
      installDir: defaults.installDir,
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
