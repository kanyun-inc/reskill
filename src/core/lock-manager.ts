import type { LockedSkill, SkillsLock } from '../types/index.js';
import { exists, getSkillsLockPath, readJson, writeJson } from '../utils/fs.js';

/**
 * Current lockfile version
 */
const LOCKFILE_VERSION = 1;

/**
 * LockManager - Manage skills.lock file
 *
 * Used for locking exact versions to ensure team consistency
 */
export class LockManager {
  private projectRoot: string;
  private lockPath: string;
  private lockData: SkillsLock | null = null;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.lockPath = getSkillsLockPath(this.projectRoot);
  }

  /**
   * Get lock file path
   */
  getLockPath(): string {
    return this.lockPath;
  }

  /**
   * Check if lock file exists
   */
  exists(): boolean {
    return exists(this.lockPath);
  }

  /**
   * Load lock file
   */
  load(): SkillsLock {
    if (this.lockData) {
      return this.lockData;
    }

    if (!this.exists()) {
      // If not exists, create empty lock
      this.lockData = {
        lockfileVersion: LOCKFILE_VERSION,
        skills: {},
      };
      return this.lockData;
    }

    try {
      this.lockData = readJson<SkillsLock>(this.lockPath);
      return this.lockData;
    } catch (error) {
      throw new Error(`Failed to parse skills.lock: ${(error as Error).message}`);
    }
  }

  /**
   * Reload lock file
   */
  reload(): SkillsLock {
    this.lockData = null;
    return this.load();
  }

  /**
   * Save lock file
   */
  save(lockToSave?: SkillsLock): void {
    const toSave = lockToSave || this.lockData;
    if (!toSave) {
      throw new Error('No lock to save');
    }
    writeJson(this.lockPath, toSave);
    this.lockData = toSave;
  }

  /**
   * Get locked skill
   */
  get(name: string): LockedSkill | undefined {
    const lock = this.load();
    return lock.skills[name];
  }

  /**
   * Set locked skill
   */
  set(name: string, skill: LockedSkill): void {
    const lock = this.load();
    lock.skills[name] = skill;
    this.save();
  }

  /**
   * Remove locked skill
   */
  remove(name: string): boolean {
    const lock = this.load();
    if (lock.skills[name]) {
      delete lock.skills[name];
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Lock a skill
   */
  lockSkill(
    name: string,
    options: {
      source: string;
      version: string;
      ref: string;
      resolved: string;
      commit: string;
      registry?: string;
    },
  ): LockedSkill {
    const lockedSkill: LockedSkill = {
      source: options.source,
      version: options.version,
      ref: options.ref,
      resolved: options.resolved,
      commit: options.commit,
      installedAt: new Date().toISOString(),
    };

    // Only persist registry URL for registry-sourced skills
    if (options.registry) {
      lockedSkill.registry = options.registry;
    }

    this.set(name, lockedSkill);
    return lockedSkill;
  }

  /**
   * Get all locked skills
   */
  getAll(): Record<string, LockedSkill> {
    const lock = this.load();
    return { ...lock.skills };
  }

  /**
   * Check if skill is locked
   */
  has(name: string): boolean {
    const lock = this.load();
    return name in lock.skills;
  }

  /**
   * Check if locked version matches current version
   */
  isVersionMatch(name: string, version: string): boolean {
    const locked = this.get(name);
    if (!locked) {
      return false;
    }
    return locked.version === version;
  }

  /**
   * Clear all locks
   */
  clear(): void {
    this.lockData = {
      lockfileVersion: LOCKFILE_VERSION,
      skills: {},
    };
    this.save();
  }

  /**
   * Delete lock file
   */
  delete(): void {
    if (this.exists()) {
      const fs = require('node:fs');
      fs.unlinkSync(this.lockPath);
    }
    this.lockData = null;
  }
}

export default LockManager;
