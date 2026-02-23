import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SkillsLock } from '../types/index.js';
import { LockManager } from './lock-manager.js';

describe('LockManager', () => {
  let tempDir: string;
  let lockManager: LockManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-lock-test-'));
    lockManager = new LockManager(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('getLockPath', () => {
    it('should return lock file path', () => {
      expect(lockManager.getLockPath()).toBe(path.join(tempDir, 'skills.lock'));
    });
  });

  describe('exists', () => {
    it('should return false when lock does not exist', () => {
      expect(lockManager.exists()).toBe(false);
    });

    it('should return true when lock exists', () => {
      fs.writeFileSync(
        path.join(tempDir, 'skills.lock'),
        JSON.stringify({ lockfileVersion: 1, skills: {} }),
      );
      expect(lockManager.exists()).toBe(true);
    });
  });

  describe('load', () => {
    it('should create empty lock when file does not exist', () => {
      const lock = lockManager.load();
      expect(lock.lockfileVersion).toBe(1);
      expect(lock.skills).toEqual({});
    });

    it('should load existing lock file', () => {
      const testLock: SkillsLock = {
        lockfileVersion: 1,
        skills: {
          'my-skill': {
            source: 'github:user/skill',
            version: '1.0.0',
            ref: 'v1.0.0',
            resolved: 'https://github.com/user/skill',
            commit: 'abc123',
            installedAt: '2025-01-21T10:00:00Z',
          },
        },
      };
      fs.writeFileSync(path.join(tempDir, 'skills.lock'), JSON.stringify(testLock));

      const lock = lockManager.load();
      expect(lock.skills['my-skill'].version).toBe('1.0.0');
      expect(lock.skills['my-skill'].ref).toBe('v1.0.0');
    });

    it('should throw on invalid JSON', () => {
      fs.writeFileSync(path.join(tempDir, 'skills.lock'), 'invalid json');
      expect(() => lockManager.load()).toThrow('Failed to parse skills.lock');
    });
  });

  describe('save', () => {
    it('should save lock file', () => {
      lockManager.lockSkill('my-skill', {
        source: 'github:user/skill',
        version: '1.0.0',
        ref: 'v1.0.0',
        resolved: 'https://github.com/user/skill',
        commit: 'abc123',
      });

      const content = fs.readFileSync(path.join(tempDir, 'skills.lock'), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.skills['my-skill'].version).toBe('1.0.0');
      expect(parsed.skills['my-skill'].ref).toBe('v1.0.0');
    });
  });

  describe('get/set', () => {
    it('should get and set locked skill', () => {
      lockManager.set('my-skill', {
        source: 'github:user/skill',
        version: '1.0.0',
        ref: 'v1.0.0',
        resolved: 'https://github.com/user/skill',
        commit: 'abc123',
        installedAt: '2025-01-21T10:00:00Z',
      });

      const skill = lockManager.get('my-skill');
      expect(skill?.version).toBe('1.0.0');
      expect(skill?.ref).toBe('v1.0.0');
      expect(skill?.commit).toBe('abc123');
    });

    it('should return undefined for non-existent skill', () => {
      expect(lockManager.get('non-existent')).toBeUndefined();
    });
  });

  describe('lockSkill', () => {
    it('should lock skill with timestamp', () => {
      const before = new Date();

      const locked = lockManager.lockSkill('my-skill', {
        source: 'github:user/skill',
        version: '1.0.0',
        ref: 'v1.0.0',
        resolved: 'https://github.com/user/skill',
        commit: 'abc123',
      });

      const after = new Date();
      const installedAt = new Date(locked.installedAt);

      expect(locked.version).toBe('1.0.0');
      expect(locked.ref).toBe('v1.0.0');
      expect(installedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(installedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should persist registry URL when provided', () => {
      const locked = lockManager.lockSkill('find-skills', {
        source: 'registry:find-skills',
        version: 'latest',
        ref: 'latest',
        resolved: 'https://private-registry.example.com/',
        commit: '',
        registry: 'https://private-registry.example.com/',
      });

      expect(locked.registry).toBe('https://private-registry.example.com/');

      // Verify persisted to disk
      const fromDisk = lockManager.get('find-skills');
      expect(fromDisk?.registry).toBe('https://private-registry.example.com/');
    });

    it('should not include registry field when not provided', () => {
      const locked = lockManager.lockSkill('git-skill', {
        source: 'github:user/skill',
        version: '1.0.0',
        ref: 'v1.0.0',
        resolved: 'https://github.com/user/skill',
        commit: 'abc123',
      });

      expect(locked.registry).toBeUndefined();

      // Verify no registry key in persisted JSON
      const fromDisk = lockManager.get('git-skill');
      expect(fromDisk?.registry).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('should remove locked skill', () => {
      lockManager.lockSkill('my-skill', {
        source: 'github:user/skill',
        version: '1.0.0',
        ref: 'v1.0.0',
        resolved: 'https://github.com/user/skill',
        commit: 'abc123',
      });

      const removed = lockManager.remove('my-skill');
      expect(removed).toBe(true);
      expect(lockManager.has('my-skill')).toBe(false);
    });

    it('should return false for non-existent skill', () => {
      expect(lockManager.remove('non-existent')).toBe(false);
    });
  });

  describe('has', () => {
    it('should return true for locked skill', () => {
      lockManager.lockSkill('my-skill', {
        source: 'github:user/skill',
        version: '1.0.0',
        ref: 'v1.0.0',
        resolved: 'https://github.com/user/skill',
        commit: 'abc123',
      });

      expect(lockManager.has('my-skill')).toBe(true);
    });

    it('should return false for non-existent skill', () => {
      expect(lockManager.has('non-existent')).toBe(false);
    });
  });

  describe('isVersionMatch', () => {
    it('should return true when version matches', () => {
      lockManager.lockSkill('my-skill', {
        source: 'github:user/skill',
        version: '1.0.0',
        ref: 'v1.0.0',
        resolved: 'https://github.com/user/skill',
        commit: 'abc123',
      });

      expect(lockManager.isVersionMatch('my-skill', '1.0.0')).toBe(true);
    });

    it('should return false when version does not match', () => {
      lockManager.lockSkill('my-skill', {
        source: 'github:user/skill',
        version: '1.0.0',
        ref: 'v1.0.0',
        resolved: 'https://github.com/user/skill',
        commit: 'abc123',
      });

      expect(lockManager.isVersionMatch('my-skill', '2.0.0')).toBe(false);
    });

    it('should return false for non-existent skill', () => {
      expect(lockManager.isVersionMatch('non-existent', '1.0.0')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return all locked skills', () => {
      lockManager.lockSkill('skill1', {
        source: 'github:user/skill1',
        version: '1.0.0',
        ref: 'v1.0.0',
        resolved: 'https://github.com/user/skill1',
        commit: 'abc123',
      });
      lockManager.lockSkill('skill2', {
        source: 'github:user/skill2',
        version: '2.0.0',
        ref: 'v2.0.0',
        resolved: 'https://github.com/user/skill2',
        commit: 'def456',
      });

      const all = lockManager.getAll();
      expect(Object.keys(all)).toHaveLength(2);
      expect(all.skill1.version).toBe('1.0.0');
      expect(all.skill1.ref).toBe('v1.0.0');
      expect(all.skill2.version).toBe('2.0.0');
      expect(all.skill2.ref).toBe('v2.0.0');
    });
  });

  describe('clear', () => {
    it('should clear all locked skills', () => {
      lockManager.lockSkill('skill1', {
        source: 'github:user/skill1',
        version: '1.0.0',
        ref: 'v1.0.0',
        resolved: 'https://github.com/user/skill1',
        commit: 'abc123',
      });

      lockManager.clear();
      expect(lockManager.has('skill1')).toBe(false);
      expect(Object.keys(lockManager.getAll())).toHaveLength(0);
    });
  });
});
