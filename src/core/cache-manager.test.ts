import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { CacheManager } from './cache-manager.js';
import type { ParsedSkillRef } from '../types/index.js';

describe('CacheManager', () => {
  let tempDir: string;
  let cacheManager: CacheManager;

  const mockParsed: ParsedSkillRef = {
    registry: 'github',
    owner: 'user',
    repo: 'skill',
    raw: 'github:user/skill@v1.0.0',
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-cache-test-'));
    cacheManager = new CacheManager(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('getCacheDir', () => {
    it('should return the cache directory', () => {
      expect(cacheManager.getCacheDir()).toBe(tempDir);
    });
  });

  describe('getSkillCachePath', () => {
    it('should return correct cache path', () => {
      const cachePath = cacheManager.getSkillCachePath(mockParsed, 'v1.0.0');
      expect(cachePath).toBe(path.join(tempDir, 'github', 'user', 'skill', 'v1.0.0'));
    });

    it('should handle different registries', () => {
      const parsed: ParsedSkillRef = {
        registry: 'gitlab.company.com',
        owner: 'team',
        repo: 'my-skill',
        raw: 'gitlab.company.com:team/my-skill',
      };
      const cachePath = cacheManager.getSkillCachePath(parsed, 'v2.0.0');
      expect(cachePath).toBe(path.join(tempDir, 'gitlab.company.com', 'team', 'my-skill', 'v2.0.0'));
    });
  });

  describe('isCached', () => {
    it('should return false when not cached', () => {
      expect(cacheManager.isCached(mockParsed, 'v1.0.0')).toBe(false);
    });

    it('should return true when cached', () => {
      const cachePath = cacheManager.getSkillCachePath(mockParsed, 'v1.0.0');
      fs.mkdirSync(cachePath, { recursive: true });
      expect(cacheManager.isCached(mockParsed, 'v1.0.0')).toBe(true);
    });
  });

  describe('get', () => {
    it('should return null when not cached', async () => {
      const result = await cacheManager.get(mockParsed, 'v1.0.0');
      expect(result).toBe(null);
    });

    it('should return cached info', async () => {
      const cachePath = cacheManager.getSkillCachePath(mockParsed, 'v1.0.0');
      fs.mkdirSync(cachePath, { recursive: true });
      fs.writeFileSync(path.join(cachePath, '.reskill-commit'), 'abc123');

      const result = await cacheManager.get(mockParsed, 'v1.0.0');
      expect(result).not.toBeNull();
      expect(result?.path).toBe(cachePath);
      expect(result?.commit).toBe('abc123');
    });
  });

  describe('clearSkill', () => {
    it('should clear specific version', () => {
      const cachePath = cacheManager.getSkillCachePath(mockParsed, 'v1.0.0');
      fs.mkdirSync(cachePath, { recursive: true });
      fs.writeFileSync(path.join(cachePath, 'test.txt'), 'test');

      cacheManager.clearSkill(mockParsed, 'v1.0.0');
      expect(fs.existsSync(cachePath)).toBe(false);
    });

    it('should clear all versions when no version specified', () => {
      const v1Path = cacheManager.getSkillCachePath(mockParsed, 'v1.0.0');
      const v2Path = cacheManager.getSkillCachePath(mockParsed, 'v2.0.0');
      
      fs.mkdirSync(v1Path, { recursive: true });
      fs.mkdirSync(v2Path, { recursive: true });

      cacheManager.clearSkill(mockParsed);
      
      expect(fs.existsSync(v1Path)).toBe(false);
      expect(fs.existsSync(v2Path)).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('should clear all cache', () => {
      const cachePath = cacheManager.getSkillCachePath(mockParsed, 'v1.0.0');
      fs.mkdirSync(cachePath, { recursive: true });

      cacheManager.clearAll();
      expect(fs.existsSync(tempDir)).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return empty stats for empty cache', () => {
      const stats = cacheManager.getStats();
      expect(stats.totalSkills).toBe(0);
      expect(stats.registries).toEqual([]);
    });

    it('should return correct stats', () => {
      // Create some cached skills
      fs.mkdirSync(path.join(tempDir, 'github', 'user1', 'skill1', 'v1.0.0'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'github', 'user1', 'skill2', 'v1.0.0'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'gitlab', 'team', 'skill3', 'v1.0.0'), { recursive: true });

      const stats = cacheManager.getStats();
      expect(stats.totalSkills).toBe(3);
      expect(stats.registries).toContain('github');
      expect(stats.registries).toContain('gitlab');
    });
  });

  describe('getCachePath (alias)', () => {
    it('should be an alias for getSkillCachePath', () => {
      const pathFromAlias = cacheManager.getCachePath(mockParsed, 'v1.0.0');
      const pathFromOriginal = cacheManager.getSkillCachePath(mockParsed, 'v1.0.0');
      expect(pathFromAlias).toBe(pathFromOriginal);
    });
  });

  describe('copyTo', () => {
    it('should copy cached skill to destination', async () => {
      // First create cached content
      const cachePath = cacheManager.getSkillCachePath(mockParsed, 'v1.0.0');
      fs.mkdirSync(cachePath, { recursive: true });
      fs.writeFileSync(path.join(cachePath, 'SKILL.md'), '# Test Skill');
      fs.writeFileSync(path.join(cachePath, 'helper.txt'), 'helper content');
      fs.writeFileSync(path.join(cachePath, '.reskill-commit'), 'abc123');

      const destPath = path.join(tempDir, 'dest-skill');
      await cacheManager.copyTo(mockParsed, 'v1.0.0', destPath);

      expect(fs.existsSync(path.join(destPath, 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(destPath, 'helper.txt'))).toBe(true);
    });
  });

  describe('subPath handling', () => {
    it('should handle parsed ref with subPath', () => {
      const parsedWithSubpath: ParsedSkillRef = {
        registry: 'github',
        owner: 'user',
        repo: 'monorepo',
        subPath: 'packages/my-skill',
        raw: 'github:user/monorepo/packages/my-skill@v1.0.0',
      };

      const cachePath = cacheManager.getSkillCachePath(parsedWithSubpath, 'v1.0.0');
      expect(cachePath).toContain('monorepo');
      expect(cachePath).toContain('v1.0.0');
    });
  });
});

// Integration tests (require network)
describe('CacheManager integration', () => {
  it.skip('should cache from real repository', async () => {
    // This test requires network access
  });
});
