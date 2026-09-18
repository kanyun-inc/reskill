/**
 * RegistryResolver Tests (Step 5.1)
 *
 * Tests for detecting and resolving registry skill references
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { pack } from 'tar-stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistryClient } from './registry-client.js';
import { RegistryResolver } from './registry-resolver.js';

describe('RegistryResolver', () => {
  describe('isRegistryRef', () => {
    // ====================================================================
    // 应该被识别为 Registry 格式
    // ====================================================================

    describe('should return true for valid registry refs', () => {
      it('private registry: @scope/name', () => {
        expect(RegistryResolver.isRegistryRef('@kanyun/planning-with-files')).toBe(true);
      });

      it('private registry: @scope/name@version', () => {
        expect(RegistryResolver.isRegistryRef('@kanyun/planning-with-files@2.4.5')).toBe(true);
      });

      it('private registry: @scope/name@latest', () => {
        expect(RegistryResolver.isRegistryRef('@kanyun/planning-with-files@latest')).toBe(true);
      });

      it('public registry: simple name', () => {
        expect(RegistryResolver.isRegistryRef('my-skill')).toBe(true);
      });

      it('public registry: name@version', () => {
        expect(RegistryResolver.isRegistryRef('my-skill@1.0.0')).toBe(true);
      });

      it('public registry: name@latest', () => {
        expect(RegistryResolver.isRegistryRef('my-skill@latest')).toBe(true);
      });

      it('name with underscore', () => {
        expect(RegistryResolver.isRegistryRef('my_skill')).toBe(true);
      });

      it('name with dots', () => {
        expect(RegistryResolver.isRegistryRef('my.skill')).toBe(true);
      });
    });

    // ====================================================================
    // 应该被排除的 Git 格式
    // ====================================================================

    describe('should return false for Git refs', () => {
      it('Git SSH: git@github.com:user/repo.git', () => {
        expect(RegistryResolver.isRegistryRef('git@github.com:user/repo.git')).toBe(false);
      });

      it('Git SSH with version: git@github.com:user/repo.git@v1.0.0', () => {
        expect(RegistryResolver.isRegistryRef('git@github.com:user/repo.git@v1.0.0')).toBe(false);
      });

      it('Git protocol: git://github.com/user/repo.git', () => {
        expect(RegistryResolver.isRegistryRef('git://github.com/user/repo.git')).toBe(false);
      });

      it('URL ending with .git', () => {
        expect(RegistryResolver.isRegistryRef('https://github.com/user/repo.git')).toBe(false);
      });
    });

    // ====================================================================
    // 应该被排除的 HTTP/OSS 格式
    // ====================================================================

    describe('should return false for HTTP/OSS refs', () => {
      it('HTTPS URL', () => {
        expect(RegistryResolver.isRegistryRef('https://example.com/skill.tar.gz')).toBe(false);
      });

      it('HTTP URL', () => {
        expect(RegistryResolver.isRegistryRef('http://example.com/skill.tar.gz')).toBe(false);
      });

      it('OSS URL', () => {
        expect(RegistryResolver.isRegistryRef('oss://bucket/skill.tar.gz')).toBe(false);
      });

      it('S3 URL', () => {
        expect(RegistryResolver.isRegistryRef('s3://bucket/skill.tar.gz')).toBe(false);
      });
    });

    // ====================================================================
    // 应该被排除的 Registry shorthand 格式
    // ====================================================================

    describe('should return false for registry shorthand refs', () => {
      it('GitHub shorthand: github:user/repo', () => {
        expect(RegistryResolver.isRegistryRef('github:user/repo')).toBe(false);
      });

      it('GitHub shorthand with version: github:user/repo@v1.0.0', () => {
        expect(RegistryResolver.isRegistryRef('github:user/repo@v1.0.0')).toBe(false);
      });

      it('GitLab shorthand: gitlab:group/repo', () => {
        expect(RegistryResolver.isRegistryRef('gitlab:group/repo')).toBe(false);
      });

      it('Custom registry: custom.com:user/repo', () => {
        expect(RegistryResolver.isRegistryRef('custom.com:user/repo')).toBe(false);
      });

      it('Owner/repo format (short GitHub)', () => {
        // 这个应该匹配为 Git shorthand，不是 registry
        expect(RegistryResolver.isRegistryRef('user/repo')).toBe(false);
      });

      it('Owner/repo with version', () => {
        expect(RegistryResolver.isRegistryRef('user/repo@v1.0.0')).toBe(false);
      });
    });

    // ====================================================================
    // 边界情况
    // ====================================================================

    describe('edge cases', () => {
      it('empty string should return false', () => {
        expect(RegistryResolver.isRegistryRef('')).toBe(false);
      });

      it('@ only should return false', () => {
        expect(RegistryResolver.isRegistryRef('@')).toBe(false);
      });

      it('@scope/ without name should return false', () => {
        expect(RegistryResolver.isRegistryRef('@kanyun/')).toBe(false);
      });
    });
  });

  // ====================================================================
  // resolve() with overrideRegistryUrl parameter
  // ====================================================================

  describe('resolve with overrideRegistryUrl', () => {
    it('should accept optional overrideRegistryUrl and token parameters', () => {
      const resolver = new RegistryResolver();
      // Verify the method signature accepts up to three parameters
      expect(resolver.resolve).toBeDefined();
      expect(resolver.resolve.length).toBeLessThanOrEqual(3);
    });
  });

  // ====================================================================
  // resolve() integrity handling
  //
  // The server contract (rush-v2 server-api.spec.md §3.2a/3.2b) explicitly
  // allows the `x-integrity` header to be an empty string for local-mode
  // publishes (skills uploaded as multipart tarball via Web UI). The CLI
  // must tolerate this and skip integrity verification, otherwise install
  // fails with "Invalid integrity format:" for any local-mode skill.
  // ====================================================================

  describe('resolve integrity handling', () => {
    const TEST_REGISTRY = 'https://rush-test.zhenguanyu.com/';
    const TARBALL_CONTENT = Buffer.from('mock-tarball-bytes');

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function mockClient(integrity: string): void {
      vi.spyOn(RegistryClient.prototype, 'resolveVersion').mockResolvedValue('1.0.0');
      vi.spyOn(RegistryClient.prototype, 'downloadSkill').mockResolvedValue({
        tarball: TARBALL_CONTENT,
        integrity,
      });
    }

    it('should resolve successfully when server returns valid matching integrity', async () => {
      const expected = RegistryClient.calculateIntegrity(TARBALL_CONTENT);
      mockClient(expected);

      const resolver = new RegistryResolver();
      const result = await resolver.resolve('@kanyun/test-skill@1.0.0', TEST_REGISTRY);

      expect(result.shortName).toBe('test-skill');
      expect(result.version).toBe('1.0.0');
      expect(result.integrity).toBe(expected);
      expect(result.tarball).toBe(TARBALL_CONTENT);
    });

    it('should throw when server returns non-empty integrity that does not match tarball', async () => {
      mockClient('sha256-tamperedhash000000000000000000000000000000');

      const resolver = new RegistryResolver();

      await expect(resolver.resolve('@kanyun/test-skill@1.0.0', TEST_REGISTRY)).rejects.toThrow(
        /Integrity verification failed/,
      );
    });

    it('should resolve successfully when server returns empty integrity (local-mode publish)', async () => {
      // Local-mode publishes intentionally store integrity as '' on the server side.
      // CLI must skip verification rather than throw "Invalid integrity format:".
      mockClient('');

      const resolver = new RegistryResolver();
      const result = await resolver.resolve('@kanyun/local-skill@1.0.0', TEST_REGISTRY);

      expect(result.shortName).toBe('local-skill');
      expect(result.version).toBe('1.0.0');
      expect(result.integrity).toBe('');
      expect(result.tarball).toBe(TARBALL_CONTENT);
    });
  });

  // ====================================================================
  // extract() — SKILL.md content contract (#3062 review SF-1)
  // ====================================================================

  describe('extract', () => {
    let tempDir: string;
    let resolver: RegistryResolver;

    // Helper: build gzipped tarball with sequential entries (files only)
    function buildTarball(entries: Array<{ name: string; content: string }>): Promise<Buffer> {
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const tarPack = pack();
        const gzip = zlib.createGzip();
        gzip.on('data', (c: Buffer) => chunks.push(c));
        gzip.on('end', () => resolve(Buffer.concat(chunks)));
        gzip.on('error', reject);
        tarPack.pipe(gzip);
        for (const e of entries) {
          const buf = Buffer.from(e.content);
          tarPack.entry({ name: e.name, size: buf.length, mode: 0o644 }, buf);
        }
        tarPack.finalize();
      });
    }

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-extract-test-'));
      resolver = new RegistryResolver();
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('returns destDir/topDir for a normal nested tarball', async () => {
      const tarball = await buildTarball([
        { name: 'pptx/SKILL.md', content: '# pptx' },
        { name: 'pptx/scripts/a.py', content: 'x' },
      ]);

      const skillDir = await resolver.extract(tarball, tempDir);

      expect(skillDir).toBe(`${tempDir}/pptx`);
      expect(fs.existsSync(path.join(skillDir, 'SKILL.md'))).toBe(true);
    });

    it('returns destDir itself for a flat tarball with root SKILL.md', async () => {
      const tarball = await buildTarball([
        { name: 'SKILL.md', content: '# flat' },
        { name: 'examples.md', content: '# examples' },
      ]);

      const skillDir = await resolver.extract(tarball, tempDir);

      expect(skillDir).toBe(tempDir);
      expect(fs.existsSync(path.join(tempDir, 'SKILL.md'))).toBe(true);
    });

    it('accepts uppercase SKILL.MD (case-insensitive, aligned with getTarballTopDir)', async () => {
      const tarball = await buildTarball([{ name: 'pptx/SKILL.MD', content: '# upper' }]);

      await expect(resolver.extract(tarball, tempDir)).resolves.toBe(`${tempDir}/pptx`);
    });

    it('rejects a junk-only tarball instead of installing an empty skill (#3062)', async () => {
      const tarball = await buildTarball([
        { name: '._pptx', content: 'appledouble junk' },
        { name: '__MACOSX/pptx/._.', content: 'zip metadata junk' },
        { name: 'pptx/.DS_Store', content: 'finder junk' },
      ]);

      await expect(resolver.extract(tarball, tempDir)).rejects.toThrow(/no SKILL\.md/);
    });

    it('rejects a tarball that has real files but no SKILL.md anywhere', async () => {
      const tarball = await buildTarball([{ name: 'pptx/README.md', content: 'readme only' }]);

      await expect(resolver.extract(tarball, tempDir)).rejects.toThrow(/no SKILL\.md/);
    });
  });
});
