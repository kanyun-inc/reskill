/**
 * Integration tests for installing skills from npm-style registry
 *
 * Tests the complete install flow for @scope/name format:
 * - Parse skill identifier (@kanyun/planning-with-files@2.4.5)
 * - Resolve registry URL from scope
 * - Download tarball and verify integrity
 * - Extract to installation directory
 *
 * NOTE: These tests require a running registry server.
 * Set REGISTRY_URL environment variable to run against a real server.
 * By default, tests use http://localhost:3000 and will be skipped if unavailable.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { extractTarballBuffer } from '../../../core/extractor.js';
import {
  checkConflict,
  detectInstallDirectory,
  ensureInstallDirectory,
  getSkillInstallPath,
} from '../../../core/install-directory.js';
import { RegistryClient } from '../../../core/registry-client.js';
import {
  getRegistryUrl,
  getShortName,
  parseSkillIdentifier,
} from '../../../utils/registry-scope.js';

// 测试配置
const REGISTRY_URL = process.env.REGISTRY_URL || 'http://localhost:3000';
const TEST_SKILL = process.env.TEST_SKILL || '@kanyun/planning-with-files';
// Dummy token to pass rush-app middleware (middleware only checks Bearer prefix existence,
// actual token validation is done in route handlers for write endpoints)
const TEST_TOKEN = process.env.REGISTRY_TOKEN || 'test-integration';

// 检查 registry 是否可用
async function isRegistryAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(
      `${REGISTRY_URL}/api/skills/${encodeURIComponent(TEST_SKILL)}`,
      {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
        },
      },
    );

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

// 在模块级别检查 registry
let registryAvailable = false;

describe('Install from npm-style Registry', () => {
  let tempDir: string;

  // 辅助函数：创建临时目录
  function createTempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-registry-e2e-'));
    return fs.realpathSync(dir);
  }

  // 辅助函数：创建项目目录结构
  function createProjectDir(structure: Record<string, unknown>): string {
    const projectDir = createTempDir();

    function createStructure(basePath: string, obj: Record<string, unknown>) {
      for (const [name, value] of Object.entries(obj)) {
        const fullPath = path.join(basePath, name);
        if (typeof value === 'object' && value !== null) {
          fs.mkdirSync(fullPath, { recursive: true });
          createStructure(fullPath, value as Record<string, unknown>);
        } else if (typeof value === 'string') {
          fs.writeFileSync(fullPath, value);
        }
      }
    }

    createStructure(projectDir, structure);
    return projectDir;
  }

  beforeAll(async () => {
    registryAvailable = await isRegistryAvailable();
    if (!registryAvailable) {
      console.log(`⚠️  Registry not available at ${REGISTRY_URL}, some tests will be skipped`);
    } else {
      console.log(`✅ Registry available at ${REGISTRY_URL}`);
    }
  });

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // ============================================================================
  // Unit-level integration tests (不需要 registry)
  // ============================================================================

  describe('parseSkillIdentifier', () => {
    it('should parse private registry format', () => {
      const result = parseSkillIdentifier('@kanyun/planning-with-files@2.4.5');

      expect(result.scope).toBe('@kanyun');
      expect(result.name).toBe('planning-with-files');
      expect(result.version).toBe('2.4.5');
      expect(result.fullName).toBe('@kanyun/planning-with-files');
    });

    it('should parse public registry format', () => {
      const result = parseSkillIdentifier('my-skill@1.0.0');

      expect(result.scope).toBeNull();
      expect(result.name).toBe('my-skill');
      expect(result.version).toBe('1.0.0');
    });
  });

  describe('getRegistryUrl', () => {
    it('should resolve @kanyun to private registry', () => {
      const registry = getRegistryUrl('@kanyun');
      expect(registry).toBe('https://rush.zhenguanyu.com/');
    });

    it('should return public registry for null scope', () => {
      const registry = getRegistryUrl(null);
      expect(registry).toBe('https://reskill.info/');
    });
  });

  describe('detectInstallDirectory', () => {
    it('should detect .claude directory', async () => {
      const projectDir = createProjectDir({ '.claude': {} });

      const installDir = await detectInstallDirectory({ cwd: projectDir });
      expect(installDir).toBe(path.join(projectDir, '.claude/skills'));

      fs.rmSync(projectDir, { recursive: true, force: true });
    });
  });

  describe('checkConflict', () => {
    it('should throw when skill already exists', async () => {
      const projectDir = createProjectDir({
        '.claude': {
          skills: {
            'existing-skill': {
              'SKILL.md': '# Existing',
            },
          },
        },
      });
      const installDir = path.join(projectDir, '.claude/skills');

      await expect(checkConflict(installDir, 'existing-skill')).rejects.toThrow(/already exists/);

      fs.rmSync(projectDir, { recursive: true, force: true });
    });
  });

  // ============================================================================
  // E2E tests (需要 registry)
  // ============================================================================

  describe('Complete install flow (requires registry)', () => {
    it(
      'should download skill and verify integrity',
      async () => {
        if (!registryAvailable) {
          console.log('Skipping: registry not available');
          return;
        }
        const client = new RegistryClient({ registry: REGISTRY_URL, token: TEST_TOKEN });
        const { scope, name, version } = parseSkillIdentifier(TEST_SKILL);

        // 1. 解析版本
        const resolvedVersion = await client.resolveVersion(
          `${scope}/${name}`,
          version || 'latest',
        );
        expect(resolvedVersion).toMatch(/^\d+\.\d+\.\d+/);

        // 2. 下载
        const { tarball, integrity } = await client.downloadSkill(
          `${scope}/${name}`,
          resolvedVersion,
        );

        expect(tarball).toBeInstanceOf(Buffer);
        expect(tarball.length).toBeGreaterThan(0);

        // 3. 验证 integrity（local source_type 的 skill 服务端可能不返回 integrity）
        if (integrity) {
          expect(integrity).toMatch(/^sha256-/);
          const isValid = RegistryClient.verifyIntegrity(tarball, integrity);
          expect(isValid).toBe(true);
        }
      },
      { timeout: 30000 },
    );

    it(
      'should extract tarball to installation directory',
      async () => {
        if (!registryAvailable) {
          console.log('Skipping: registry not available');
          return;
        }
        const client = new RegistryClient({ registry: REGISTRY_URL, token: TEST_TOKEN });
        const { scope, name } = parseSkillIdentifier(TEST_SKILL);
        const shortName = getShortName(`${scope}/${name}`);

        // 1. 下载
        const resolvedVersion = await client.resolveVersion(`${scope}/${name}`, 'latest');
        const { tarball } = await client.downloadSkill(`${scope}/${name}`, resolvedVersion);

        // 2. 创建项目目录
        const projectDir = createProjectDir({ '.claude': {} });
        const installDir = path.join(projectDir, '.claude/skills');
        await ensureInstallDirectory(installDir);

        // 3. 检查冲突
        await checkConflict(installDir, shortName);

        // 4. 解压
        await extractTarballBuffer(tarball, installDir);

        // 5. 验证结果
        const skillPath = getSkillInstallPath(installDir, shortName);

        // 检查文件是否存在（可能有顶层目录，也可能没有）
        const exists =
          fs.existsSync(path.join(skillPath, 'SKILL.md')) ||
          fs.existsSync(path.join(installDir, 'SKILL.md'));

        expect(exists).toBe(true);

        // 清理
        fs.rmSync(projectDir, { recursive: true, force: true });
      },
      { timeout: 30000 },
    );

    it(
      'should complete full install flow',
      async () => {
        if (!registryAvailable) {
          console.log('Skipping: registry not available');
          return;
        }
        // 完整流程测试
        const identifier = TEST_SKILL;
        const { scope, name, version } = parseSkillIdentifier(identifier);
        const shortName = getShortName(`${scope}/${name}`);

        // 1. 获取 registry URL
        const registryUrl = scope ? getRegistryUrl(scope) : getRegistryUrl(null);
        expect(registryUrl).toBeTruthy();

        // 使用测试 registry
        const client = new RegistryClient({ registry: REGISTRY_URL, token: TEST_TOKEN });

        // 2. 解析版本
        const resolvedVersion = await client.resolveVersion(
          `${scope}/${name}`,
          version || 'latest',
        );

        // 3. 下载并验证
        const { tarball, integrity } = await client.downloadSkill(
          `${scope}/${name}`,
          resolvedVersion,
        );

        if (integrity) {
          expect(RegistryClient.verifyIntegrity(tarball, integrity)).toBe(true);
        }

        // 4. 检测安装目录
        const projectDir = createProjectDir({ '.claude': {} });
        const installDir = await detectInstallDirectory({ cwd: projectDir });
        await ensureInstallDirectory(installDir);

        // 5. 检查冲突
        await checkConflict(installDir, shortName);

        // 6. 解压
        await extractTarballBuffer(tarball, installDir);

        // 7. 验证最终结果
        console.log(`✅ Installed ${identifier}@${resolvedVersion} to ${installDir}`);
        console.log(`   Files:`, fs.readdirSync(installDir));

        // 清理
        fs.rmSync(projectDir, { recursive: true, force: true });
      },
      { timeout: 30000 },
    );
  });

  // ============================================================================
  // Local source_type version specifier tests (requires registry)
  // ============================================================================

  describe('Local source_type with version specifier (requires registry)', () => {
    // Test dependency: requires @kanyun-test/ppt-generator to exist on the target
    // registry (REGISTRY_URL) with at least two published versions.
    // Currently published on https://rush-test.zhenguanyu.com with versions 1.0.0 and 1.0.2.
    // If this skill is removed or versions change, update the constants below.
    const LOCAL_SKILL = '@kanyun-test/ppt-generator';
    const LOCAL_SKILL_OLD_VERSION = '1.0.0';

    it(
      'should resolve specific version for local source_type skill',
      async () => {
        if (!registryAvailable) {
          console.log('Skipping: registry not available');
          return;
        }
        const client = new RegistryClient({ registry: REGISTRY_URL, token: TEST_TOKEN });

        // Resolve a specific version (should return as-is for semver)
        const resolved = await client.resolveVersion(LOCAL_SKILL, LOCAL_SKILL_OLD_VERSION);
        expect(resolved).toBe(LOCAL_SKILL_OLD_VERSION);
      },
      { timeout: 30000 },
    );

    it(
      'should resolve latest tag for local source_type skill',
      async () => {
        if (!registryAvailable) {
          console.log('Skipping: registry not available');
          return;
        }
        const client = new RegistryClient({ registry: REGISTRY_URL, token: TEST_TOKEN });

        // Resolve latest tag — should return a semver version
        const resolved = await client.resolveVersion(LOCAL_SKILL, 'latest');
        expect(resolved).toMatch(/^\d+\.\d+\.\d+/);
        console.log(`✅ Resolved ${LOCAL_SKILL}@latest → ${resolved}`);
      },
      { timeout: 30000 },
    );

    it(
      'should download specific version tarball for local source_type skill',
      async () => {
        if (!registryAvailable) {
          console.log('Skipping: registry not available');
          return;
        }
        const client = new RegistryClient({ registry: REGISTRY_URL, token: TEST_TOKEN });

        // Download old version tarball
        const { tarball } = await client.downloadSkill(LOCAL_SKILL, LOCAL_SKILL_OLD_VERSION);
        expect(tarball).toBeInstanceOf(Buffer);
        expect(tarball.length).toBeGreaterThan(0);
        console.log(`✅ Downloaded ${LOCAL_SKILL}@${LOCAL_SKILL_OLD_VERSION} (${tarball.length} bytes)`);
      },
      { timeout: 30000 },
    );

    it(
      'should download different tarballs for different versions',
      async () => {
        if (!registryAvailable) {
          console.log('Skipping: registry not available');
          return;
        }
        const client = new RegistryClient({ registry: REGISTRY_URL, token: TEST_TOKEN });

        // Resolve latest version
        const latestVersion = await client.resolveVersion(LOCAL_SKILL, 'latest');

        // Download both versions
        const { tarball: oldTarball } = await client.downloadSkill(LOCAL_SKILL, LOCAL_SKILL_OLD_VERSION);
        const { tarball: latestTarball } = await client.downloadSkill(LOCAL_SKILL, latestVersion);

        expect(oldTarball).toBeInstanceOf(Buffer);
        expect(latestTarball).toBeInstanceOf(Buffer);

        // If versions differ, tarballs should differ (size or content)
        if (LOCAL_SKILL_OLD_VERSION !== latestVersion) {
          const isDifferent =
            oldTarball.length !== latestTarball.length || !oldTarball.equals(latestTarball);
          expect(isDifferent).toBe(true);
          console.log(
            `✅ Verified different tarballs: v${LOCAL_SKILL_OLD_VERSION} (${oldTarball.length}B) vs v${latestVersion} (${latestTarball.length}B)`,
          );
        }
      },
      { timeout: 30000 },
    );
  });

  // ============================================================================
  // Error handling tests
  // ============================================================================

  describe('Error handling', () => {
    it('should handle non-existent skill', async () => {
      if (!registryAvailable) {
        console.log('Skipping: registry not available');
        return;
      }
      const client = new RegistryClient({ registry: REGISTRY_URL, token: TEST_TOKEN });

      await expect(
        client.resolveVersion('@kanyun/non-existent-skill-xyz', 'latest'),
      ).rejects.toThrow();
    });

    it('should handle non-existent version', async () => {
      if (!registryAvailable) {
        console.log('Skipping: registry not available');
        return;
      }
      const client = new RegistryClient({ registry: REGISTRY_URL, token: TEST_TOKEN });
      const { scope, name } = parseSkillIdentifier(TEST_SKILL);

      // Server may either reject with an error or fallback to latest version (302).
      // Both behaviors are acceptable — we just verify it doesn't crash.
      try {
        const { tarball } = await client.downloadSkill(`${scope}/${name}`, '999.999.999');
        // If server falls back to latest, we get a valid tarball
        expect(tarball).toBeInstanceOf(Buffer);
        expect(tarball.length).toBeGreaterThan(0);
      } catch (error) {
        // If server rejects, it should throw a meaningful error
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBeTruthy();
      }
    });

    it('should throw for unknown scope', () => {
      expect(() => getRegistryUrl('@unknown-scope')).toThrow(/Unknown scope/);
    });
  });
});
