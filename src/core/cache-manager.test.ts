import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ParsedSkillRef } from '../types/index.js';
import { CacheManager } from './cache-manager.js';

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
      expect(cachePath).toBe(
        path.join(tempDir, 'gitlab.company.com', 'team', 'my-skill', 'v2.0.0'),
      );
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

    it('should exclude .reskill-commit file', async () => {
      const cachePath = cacheManager.getSkillCachePath(mockParsed, 'v1.0.0');
      fs.mkdirSync(cachePath, { recursive: true });
      fs.writeFileSync(path.join(cachePath, 'SKILL.md'), '# Test Skill');
      fs.writeFileSync(path.join(cachePath, '.reskill-commit'), 'abc123');

      const destPath = path.join(tempDir, 'dest-skill');
      await cacheManager.copyTo(mockParsed, 'v1.0.0', destPath);

      expect(fs.existsSync(path.join(destPath, 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(destPath, '.reskill-commit'))).toBe(false);
    });

    it('should exclude README.md file (consistent with Installer)', async () => {
      const cachePath = cacheManager.getSkillCachePath(mockParsed, 'v1.0.0');
      fs.mkdirSync(cachePath, { recursive: true });
      fs.writeFileSync(path.join(cachePath, 'SKILL.md'), '# Test Skill');
      fs.writeFileSync(path.join(cachePath, 'README.md'), '# README');
      fs.writeFileSync(path.join(cachePath, '.reskill-commit'), 'abc123');

      const destPath = path.join(tempDir, 'dest-skill');
      await cacheManager.copyTo(mockParsed, 'v1.0.0', destPath);

      expect(fs.existsSync(path.join(destPath, 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(destPath, 'README.md'))).toBe(false);
    });

    it('should exclude metadata.json file (consistent with Installer)', async () => {
      const cachePath = cacheManager.getSkillCachePath(mockParsed, 'v1.0.0');
      fs.mkdirSync(cachePath, { recursive: true });
      fs.writeFileSync(path.join(cachePath, 'SKILL.md'), '# Test Skill');
      fs.writeFileSync(path.join(cachePath, 'metadata.json'), '{"internal": true}');
      fs.writeFileSync(path.join(cachePath, '.reskill-commit'), 'abc123');

      const destPath = path.join(tempDir, 'dest-skill');
      await cacheManager.copyTo(mockParsed, 'v1.0.0', destPath);

      expect(fs.existsSync(path.join(destPath, 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(destPath, 'metadata.json'))).toBe(false);
    });

    it('should exclude files starting with underscore (consistent with Installer)', async () => {
      const cachePath = cacheManager.getSkillCachePath(mockParsed, 'v1.0.0');
      fs.mkdirSync(cachePath, { recursive: true });
      fs.writeFileSync(path.join(cachePath, 'SKILL.md'), '# Test Skill');
      fs.writeFileSync(path.join(cachePath, '_private.md'), 'private');
      fs.writeFileSync(path.join(cachePath, '.reskill-commit'), 'abc123');

      const destPath = path.join(tempDir, 'dest-skill');
      await cacheManager.copyTo(mockParsed, 'v1.0.0', destPath);

      expect(fs.existsSync(path.join(destPath, 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(destPath, '_private.md'))).toBe(false);
    });
  });

  describe('getRemoteCommit', () => {
    it('should return empty string when git command fails', async () => {
      // Use invalid URL to trigger failure
      const commit = await cacheManager.getRemoteCommit('invalid://url', 'main');
      expect(commit).toBe('');
    });

    it.skip('should return empty string for non-existent repository', async () => {
      const commit = await cacheManager.getRemoteCommit(
        'https://github.com/nonexistent-user-xyz/nonexistent-repo-abc.git',
        'main',
      );
      expect(commit).toBe('');
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

  describe('cache() with subPath extraction', () => {
    let repoDir: string;

    /**
     * Helper to create a local git monorepo for testing
     */
    function createLocalMonorepo(skills: Array<{ name: string; version: string; subPath: string }>): string {
      const repoPath = path.join(repoDir, 'monorepo');
      fs.mkdirSync(repoPath, { recursive: true });

      // Create root README
      fs.writeFileSync(path.join(repoPath, 'README.md'), '# Monorepo\n');

      // Create each skill
      for (const skill of skills) {
        const skillPath = path.join(repoPath, skill.subPath);
        fs.mkdirSync(skillPath, { recursive: true });
        fs.writeFileSync(
          path.join(skillPath, 'skill.json'),
          JSON.stringify({ name: skill.name, version: skill.version }, null, 2),
        );
        fs.writeFileSync(
          path.join(skillPath, 'SKILL.md'),
          `# ${skill.name}\n\nVersion ${skill.version}`,
        );
      }

      // Init git repo with explicit 'main' branch
      execSync('git init -b main', { cwd: repoPath, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: repoPath, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: repoPath, stdio: 'pipe' });
      execSync('git add -A', { cwd: repoPath, stdio: 'pipe' });
      execSync('git commit -m "init"', { cwd: repoPath, stdio: 'pipe' });

      return `file://${repoPath}`;
    }

    beforeEach(() => {
      repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-repo-'));
    });

    afterEach(() => {
      fs.rmSync(repoDir, { recursive: true, force: true });
    });

    it('should extract only subPath contents when caching from monorepo', async () => {
      const repoUrl = createLocalMonorepo([
        { name: 'skill-a', version: '1.0.0', subPath: 'skills/skill-a' },
        { name: 'skill-b', version: '2.0.0', subPath: 'skills/skill-b' },
      ]);

      const parsed: ParsedSkillRef = {
        registry: 'file',
        owner: 'local',
        repo: 'monorepo',
        subPath: 'skills/skill-a',
        raw: `${repoUrl}/skills/skill-a`,
      };

      // Use 'main' as ref (explicit default branch in helper)
      const result = await cacheManager.cache(repoUrl, parsed, 'main', 'v1.0.0');

      // Verify only skill-a contents are cached
      expect(fs.existsSync(path.join(result.path, 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(result.path, 'skill.json'))).toBe(true);

      // Verify root README is NOT present (it's outside subPath)
      expect(fs.existsSync(path.join(result.path, 'README.md'))).toBe(false);

      // Verify skill-b is NOT present
      expect(fs.existsSync(path.join(result.path, 'skills', 'skill-b'))).toBe(false);

      // Verify skill.json content
      const skillJson = JSON.parse(fs.readFileSync(path.join(result.path, 'skill.json'), 'utf-8'));
      expect(skillJson.name).toBe('skill-a');
      expect(skillJson.version).toBe('1.0.0');
    });

    it('should throw error when subPath does not exist', async () => {
      const repoUrl = createLocalMonorepo([
        { name: 'skill-a', version: '1.0.0', subPath: 'skills/skill-a' },
      ]);

      const parsed: ParsedSkillRef = {
        registry: 'file',
        owner: 'local',
        repo: 'monorepo',
        subPath: 'skills/nonexistent',
        raw: `${repoUrl}/skills/nonexistent`,
      };

      await expect(cacheManager.cache(repoUrl, parsed, 'main', 'v1.0.0'))
        .rejects.toThrow(/not found/i);
    });

    it('should handle deeply nested subPaths', async () => {
      const repoUrl = createLocalMonorepo([
        { name: 'deep-skill', version: '1.0.0', subPath: 'packages/ai/skills/deep-skill' },
      ]);

      const parsed: ParsedSkillRef = {
        registry: 'file',
        owner: 'local',
        repo: 'monorepo',
        subPath: 'packages/ai/skills/deep-skill',
        raw: `${repoUrl}/packages/ai/skills/deep-skill`,
      };

      const result = await cacheManager.cache(repoUrl, parsed, 'main', 'v1.0.0');

      expect(fs.existsSync(path.join(result.path, 'SKILL.md'))).toBe(true);
      const skillJson = JSON.parse(fs.readFileSync(path.join(result.path, 'skill.json'), 'utf-8'));
      expect(skillJson.name).toBe('deep-skill');
    });

    it('should cache entire repo when no subPath specified', async () => {
      const repoUrl = createLocalMonorepo([
        { name: 'skill-a', version: '1.0.0', subPath: 'skills/skill-a' },
      ]);

      const parsed: ParsedSkillRef = {
        registry: 'file',
        owner: 'local',
        repo: 'monorepo',
        // No subPath
        raw: repoUrl,
      };

      const result = await cacheManager.cache(repoUrl, parsed, 'main', 'v1.0.0');

      // Verify root README IS present
      expect(fs.existsSync(path.join(result.path, 'README.md'))).toBe(true);
      // Verify skill-a IS present in its subPath
      expect(fs.existsSync(path.join(result.path, 'skills', 'skill-a', 'SKILL.md'))).toBe(true);
    });
  });
});

// Integration tests (require network)
describe('CacheManager integration', () => {
  it.skip('should cache from real repository', async () => {
    // This test requires network access
  });
});
