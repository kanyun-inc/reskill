/**
 * RegistryClient unit tests
 *
 * Tests for registry API interactions with mocked fetch
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { extract } from 'tar-stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistryClient, RegistryError } from './registry-client.js';

// 辅助函数：解压 tarball 并返回文件名列表
async function extractTarballEntries(tarball: Buffer): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const entries: string[] = [];
    const gunzip = zlib.createGunzip();
    const extractor = extract();

    extractor.on('entry', (header, stream, next) => {
      entries.push(header.name);
      stream.on('end', next);
      stream.resume();
    });

    extractor.on('finish', () => resolve(entries));
    extractor.on('error', reject);
    gunzip.on('error', reject);

    gunzip.pipe(extractor);
    gunzip.end(tarball);
  });
}

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('RegistryError', () => {
  it('should create error with message only', () => {
    const error = new RegistryError('Test error');

    expect(error.message).toBe('Test error');
    expect(error.name).toBe('RegistryError');
    expect(error.statusCode).toBeUndefined();
    expect(error.response).toBeUndefined();
  });

  it('should create error with status code', () => {
    const error = new RegistryError('Unauthorized', 401);

    expect(error.message).toBe('Unauthorized');
    expect(error.statusCode).toBe(401);
    expect(error.response).toBeUndefined();
  });

  it('should create error with full details', () => {
    const responseData = { error: 'Invalid credentials' };
    const error = new RegistryError('Login failed', 401, responseData);

    expect(error.message).toBe('Login failed');
    expect(error.statusCode).toBe(401);
    expect(error.response).toEqual(responseData);
  });

  it('should be instanceof Error', () => {
    const error = new RegistryError('Test');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(RegistryError);
  });
});

describe('RegistryClient', () => {
  let client: RegistryClient;
  const testRegistry = 'https://registry.example.com';
  const testToken = 'test_token_123';

  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Constructor tests
  // ============================================================================

  describe('constructor', () => {
    it('should create client with registry only', () => {
      client = new RegistryClient({ registry: testRegistry });
      expect(client).toBeInstanceOf(RegistryClient);
    });

    it('should create client with registry and token', () => {
      client = new RegistryClient({ registry: testRegistry, token: testToken });
      expect(client).toBeInstanceOf(RegistryClient);
    });
  });

  // ============================================================================
  // whoami tests
  // ============================================================================

  describe('whoami', () => {
    it('should send whoami request without token', async () => {
      client = new RegistryClient({ registry: testRegistry });

      const mockResponse = {
        success: true,
        user: {
          id: 'testuser',
          handle: 'kanyun',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.whoami();

      expect(mockFetch).toHaveBeenCalledWith(
        `${testRegistry}/api/auth/me`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'User-Agent': 'reskill/1.0',
            'X-Client-Type': 'cli',
          }),
        }),
      );

      // Should NOT have Authorization header without token
      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders).not.toHaveProperty('Authorization');

      expect(result).toEqual(mockResponse);
    });

    it('should send whoami request with token', async () => {
      client = new RegistryClient({ registry: testRegistry, token: testToken });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            user: {
              id: 'testuser',
              handle: 'kanyun',
            },
          }),
      });

      await client.whoami();

      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders.Authorization).toBe(`Bearer ${testToken}`);
    });

    it('should return user with both id and handle', async () => {
      client = new RegistryClient({ registry: testRegistry, token: testToken });

      const mockResponse = {
        success: true,
        user: {
          id: 'wangzirenbj',
          handle: 'kanyun',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.whoami();

      expect(result.success).toBe(true);
      expect(result.user?.id).toBe('wangzirenbj');
      expect(result.user?.handle).toBe('kanyun');
    });

    it('should throw RegistryError on whoami failure', async () => {
      client = new RegistryClient({ registry: testRegistry });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Not authenticated' }),
      });

      try {
        await client.whoami();
        expect.fail('Expected RegistryError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RegistryError);
        expect((error as RegistryError).message).toBe('Not authenticated');
        expect((error as RegistryError).statusCode).toBe(401);
      }
    });

    it('should use default error message when none provided', async () => {
      client = new RegistryClient({ registry: testRegistry });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({}),
      });

      await expect(client.whoami()).rejects.toThrow('Whoami failed: 403');
    });
  });

  // ============================================================================
  // loginCli tests
  // ============================================================================

  describe('loginCli', () => {
    it('should send POST request to /api/auth/login-cli', async () => {
      client = new RegistryClient({ registry: testRegistry, token: testToken });

      const mockResponse = {
        success: true,
        user: {
          id: 'testuser',
          handle: 'kanyun',
          email: 'test@example.com',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.loginCli();

      expect(mockFetch).toHaveBeenCalledWith(
        `${testRegistry}/api/auth/login-cli`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${testToken}`,
            'User-Agent': 'reskill/1.0',
            'X-Client-Type': 'cli',
          }),
        }),
      );

      expect(result).toEqual(mockResponse);
    });

    it('should return user with id, handle and email', async () => {
      client = new RegistryClient({ registry: testRegistry, token: testToken });

      const mockResponse = {
        success: true,
        user: {
          id: 'wangzirenbj',
          handle: 'kanyun',
          email: 'wangzirenbj@zhenguanyu.com',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.loginCli();

      expect(result.success).toBe(true);
      expect(result.user?.id).toBe('wangzirenbj');
      expect(result.user?.handle).toBe('kanyun');
      expect(result.user?.email).toBe('wangzirenbj@zhenguanyu.com');
    });

    it('should return user without email when not provided', async () => {
      client = new RegistryClient({ registry: testRegistry, token: testToken });

      const mockResponse = {
        success: true,
        user: {
          id: 'testuser',
          handle: 'kanyun',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.loginCli();

      expect(result.success).toBe(true);
      expect(result.user?.id).toBe('testuser');
      expect(result.user?.handle).toBe('kanyun');
      expect(result.user?.email).toBeUndefined();
    });

    it('should throw RegistryError on authentication failure', async () => {
      client = new RegistryClient({ registry: testRegistry, token: 'invalid_token' });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ success: false, error: 'Invalid token' }),
      });

      try {
        await client.loginCli();
        expect.fail('Expected RegistryError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RegistryError);
        expect((error as RegistryError).message).toBe('Invalid token');
        expect((error as RegistryError).statusCode).toBe(401);
      }
    });

    it('should throw RegistryError when token is missing', async () => {
      client = new RegistryClient({ registry: testRegistry });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ success: false, error: 'Missing Authorization header' }),
      });

      await expect(client.loginCli()).rejects.toThrow('Missing Authorization header');
    });

    it('should use default error message when none provided', async () => {
      client = new RegistryClient({ registry: testRegistry, token: testToken });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });

      await expect(client.loginCli()).rejects.toThrow('Login failed: 500');
    });

    it('should handle rate limit error', async () => {
      client = new RegistryClient({ registry: testRegistry, token: testToken });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ success: false, error: 'Too many requests' }),
      });

      try {
        await client.loginCli();
        expect.fail('Expected RegistryError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RegistryError);
        expect((error as RegistryError).message).toBe('Too many requests');
        expect((error as RegistryError).statusCode).toBe(429);
      }
    });
  });

  // ============================================================================
  // createTarball tests
  // ============================================================================

  describe('createTarball', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-tarball-test-'));
      client = new RegistryClient({ registry: testRegistry });
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should create tarball from skill files', async () => {
      // Create test files
      fs.writeFileSync(path.join(tempDir, 'skill.json'), JSON.stringify({ name: 'test-skill' }));
      fs.writeFileSync(path.join(tempDir, 'SKILL.md'), '# Test Skill');

      const tarball = await client.createTarball(tempDir, ['skill.json', 'SKILL.md']);

      expect(tarball).toBeInstanceOf(Buffer);
      expect(tarball.length).toBeGreaterThan(0);

      // Verify it's gzipped (magic bytes)
      expect(tarball[0]).toBe(0x1f);
      expect(tarball[1]).toBe(0x8b);
    });

    it('should skip non-existent files', async () => {
      fs.writeFileSync(path.join(tempDir, 'skill.json'), JSON.stringify({ name: 'test-skill' }));

      const tarball = await client.createTarball(tempDir, ['skill.json', 'non-existent.md']);

      expect(tarball).toBeInstanceOf(Buffer);
      expect(tarball.length).toBeGreaterThan(0);
    });

    it('should handle empty file list', async () => {
      const tarball = await client.createTarball(tempDir, []);

      expect(tarball).toBeInstanceOf(Buffer);
      // Even empty tarball has gzip headers
      expect(tarball[0]).toBe(0x1f);
      expect(tarball[1]).toBe(0x8b);
    });

    it('should preserve file content', async () => {
      const content = JSON.stringify({ name: 'test-skill', version: '1.0.0' }, null, 2);
      fs.writeFileSync(path.join(tempDir, 'skill.json'), content);

      const tarball = await client.createTarball(tempDir, ['skill.json']);

      // Tarball should contain the file content (compressed)
      expect(tarball.length).toBeGreaterThan(0);
    });

    // ========================================================================
    // shortName parameter tests (Step 2.4)
    // ========================================================================

    it('should use short name as top-level directory when shortName provided', async () => {
      fs.writeFileSync(path.join(tempDir, 'SKILL.md'), '# Test Skill');
      fs.writeFileSync(path.join(tempDir, 'examples.md'), '# Examples');

      const tarball = await client.createTarball(
        tempDir,
        ['SKILL.md', 'examples.md'],
        'planning-with-files',
      );
      const entries = await extractTarballEntries(tarball);

      expect(entries).toContain('planning-with-files/SKILL.md');
      expect(entries).toContain('planning-with-files/examples.md');
    });

    it('should not include scope in tarball paths', async () => {
      fs.writeFileSync(path.join(tempDir, 'SKILL.md'), '# Test Skill');

      const tarball = await client.createTarball(tempDir, ['SKILL.md'], 'my-skill');
      const entries = await extractTarballEntries(tarball);

      // 不应包含任何带 @ 的路径
      expect(entries.some((e) => e.includes('@'))).toBe(false);
      expect(entries).toContain('my-skill/SKILL.md');
    });

    it('should preserve nested directory structure with shortName', async () => {
      // 创建嵌套目录
      fs.mkdirSync(path.join(tempDir, 'scripts'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'SKILL.md'), '# Test Skill');
      fs.writeFileSync(path.join(tempDir, 'scripts', 'init.sh'), '#!/bin/bash');

      const tarball = await client.createTarball(
        tempDir,
        ['SKILL.md', 'scripts/init.sh'],
        'my-skill',
      );
      const entries = await extractTarballEntries(tarball);

      expect(entries).toContain('my-skill/SKILL.md');
      expect(entries).toContain('my-skill/scripts/init.sh');
    });

    it('should work without shortName for backward compatibility', async () => {
      fs.writeFileSync(path.join(tempDir, 'SKILL.md'), '# Test Skill');

      // 不传 shortName 参数
      const tarball = await client.createTarball(tempDir, ['SKILL.md']);
      const entries = await extractTarballEntries(tarball);

      // 应该使用扁平结构（无顶层目录）
      expect(entries).toContain('SKILL.md');
    });
  });

  // ============================================================================
  // publish tests
  // ============================================================================

  describe('publish', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-publish-test-'));
      client = new RegistryClient({ registry: testRegistry, token: testToken });

      // Create test files
      fs.writeFileSync(
        path.join(tempDir, 'skill.json'),
        JSON.stringify({ name: 'test-skill', version: '1.0.0' }),
      );
      fs.writeFileSync(path.join(tempDir, 'SKILL.md'), '# Test Skill\n\nA test skill.');
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should send publish request with correct payload', async () => {
      const mockResponse = {
        success: true,
        ok: true,
        data: {
          name: 'test-skill',
          version: '1.0.0',
          integrity: 'sha512-abc123',
          tag: 'latest',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const payload = {
        version: '1.0.0',
        description: 'A test skill',
        files: ['skill.json', 'SKILL.md'],
        skillJson: { name: 'test-skill', version: '1.0.0', description: 'A test skill' },
        repositoryUrl: 'https://github.com/test/skill',
        sourceRef: 'github:test/skill',
        gitRef: 'v1.0.0',
        gitCommit: 'abc123',
        entry: 'SKILL.md',
        integrity: 'sha512-test',
      };

      const result = await client.publish('test-skill', payload, tempDir);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `${testRegistry}/api/skills/publish`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${testToken}`,
            'User-Agent': 'reskill/1.0',
            'X-Client-Type': 'cli',
          }),
        }),
      );

      // Verify FormData was sent
      const body = mockFetch.mock.calls[0][1].body;
      expect(body).toBeInstanceOf(FormData);

      expect(result).toEqual(mockResponse);
    });

    it('should include optional fields when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const payload = {
        version: '1.0.0',
        description: 'A test skill',
        files: ['skill.json', 'SKILL.md'],
        skillJson: {
          name: 'test-skill',
          version: '1.0.0',
          description: 'A test skill',
          license: 'MIT',
        },
        skillMd: {
          name: 'test-skill',
          description: 'A test skill',
          compatibility: 'cursor,claude-code',
          allowedTools: ['read_file', 'write'],
        },
        keywords: ['test', 'skill'],
        compatibility: { cursor: '>=0.1.0' },
        repositoryUrl: 'https://github.com/test/skill',
        sourceRef: 'github:test/skill',
        gitRef: 'v1.0.0',
        gitCommit: 'abc123',
        entry: 'SKILL.md',
        integrity: 'sha512-test',
      };

      await client.publish('test-skill', payload, tempDir, { tag: 'beta' });

      const body = mockFetch.mock.calls[0][1].body as FormData;
      expect(body.get('name')).toBe('test-skill');
      expect(body.get('version')).toBe('1.0.0');
      expect(body.get('description')).toBe('A test skill');
      expect(body.get('license')).toBe('MIT');
      expect(body.get('compatibility')).toBe('cursor,claude-code');
      expect(body.get('tag')).toBe('beta');
      expect(body.get('allowed_tools')).toBe('read_file write');
    });

    it('should throw RegistryError on publish failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Version already exists' }),
      });

      const payload = {
        version: '1.0.0',
        description: 'A test skill',
        files: ['skill.json', 'SKILL.md'],
        skillJson: { name: 'test-skill', version: '1.0.0', description: 'A test skill' },
        repositoryUrl: 'https://github.com/test/skill',
        sourceRef: 'github:test/skill',
        gitRef: 'v1.0.0',
        gitCommit: 'abc123',
        entry: 'SKILL.md',
        integrity: 'sha512-test',
      };

      try {
        await client.publish('test-skill', payload, tempDir);
        expect.fail('Expected RegistryError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RegistryError);
        expect((error as RegistryError).message).toBe('Version already exists');
        expect((error as RegistryError).statusCode).toBe(403);
      }
    });

    it('should use default error message when none provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });

      const payload = {
        version: '1.0.0',
        description: 'A test skill',
        files: ['skill.json'],
        skillJson: { name: 'test-skill', version: '1.0.0', description: 'A test skill' },
        repositoryUrl: '',
        sourceRef: '',
        gitRef: '',
        gitCommit: '',
        entry: 'SKILL.md',
        integrity: 'sha512-test',
      };

      await expect(client.publish('test-skill', payload, tempDir)).rejects.toThrow(
        'Publish failed: 500',
      );
    });

    it('should handle skill name with slash', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const payload = {
        version: '1.0.0',
        description: 'A scoped skill',
        files: ['skill.json'],
        skillJson: { name: '@scope/skill', version: '1.0.0', description: 'A scoped skill' },
        repositoryUrl: '',
        sourceRef: '',
        gitRef: '',
        gitCommit: '',
        entry: 'SKILL.md',
        integrity: 'sha512-test',
      };

      await client.publish('@scope/skill', payload, tempDir);

      // The tarball filename should replace / with -
      const body = mockFetch.mock.calls[0][1].body as FormData;
      const tarball = body.get('tarball') as File;
      expect(tarball.name).toBe('@scope-skill.tgz');
    });
  });

  // ============================================================================
  // Authorization header tests
  // ============================================================================

  describe('authorization headers', () => {
    it('should not include Authorization header when no token', async () => {
      client = new RegistryClient({ registry: testRegistry });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.whoami();

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBeUndefined();
    });

    it('should include Authorization header when token provided', async () => {
      client = new RegistryClient({ registry: testRegistry, token: testToken });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.whoami();

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe(`Bearer ${testToken}`);
    });

    it('should include User-Agent and X-Client-Type headers', async () => {
      client = new RegistryClient({ registry: testRegistry });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.whoami();

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['User-Agent']).toBe('reskill/1.0');
      expect(headers['X-Client-Type']).toBe('cli');
    });
  });

  // ============================================================================
  // resolveVersion tests (Step 3.3)
  // ============================================================================

  describe('resolveVersion', () => {
    beforeEach(() => {
      client = new RegistryClient({ registry: testRegistry, token: testToken });
    });

    it('should resolve latest tag to actual version', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            'dist-tags': { latest: '2.4.5', beta: '3.0.0-beta.1' },
          }),
      });

      const version = await client.resolveVersion('@kanyun/test-skill', 'latest');
      expect(version).toBe('2.4.5');

      expect(mockFetch).toHaveBeenCalledWith(
        `${testRegistry}/api/skills/${encodeURIComponent('@kanyun/test-skill')}`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should resolve beta tag to actual version', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            'dist-tags': { latest: '2.4.5', beta: '3.0.0-beta.1' },
          }),
      });

      const version = await client.resolveVersion('@kanyun/test-skill', 'beta');
      expect(version).toBe('3.0.0-beta.1');
    });

    it('should return semver version as-is', async () => {
      // 如果传入的是 semver 版本号，直接返回，不发请求
      const version = await client.resolveVersion('@kanyun/test-skill', '2.4.5');
      expect(version).toBe('2.4.5');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw error for non-existent tag', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            'dist-tags': { latest: '2.4.5' },
          }),
      });

      await expect(client.resolveVersion('@kanyun/test-skill', 'nonexistent')).rejects.toThrow(
        "Tag 'nonexistent' not found",
      );
    });

    it('should throw error for non-existent skill', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Skill not found' }),
      });

      await expect(client.resolveVersion('@kanyun/non-existent', 'latest')).rejects.toThrow(
        'Skill not found',
      );
    });

    it('should default to latest when no version specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            'dist-tags': { latest: '1.0.0' },
          }),
      });

      const version = await client.resolveVersion('@kanyun/test-skill');
      expect(version).toBe('1.0.0');
    });
  });

  // ============================================================================
  // downloadSkill tests (Step 3.3)
  // ============================================================================

  describe('downloadSkill', () => {
    beforeEach(() => {
      client = new RegistryClient({ registry: testRegistry, token: testToken });
    });

    it('should download tarball successfully', async () => {
      const mockTarballContent = Buffer.from('mock tarball content');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'x-integrity': 'sha256-mockhash123',
          'content-type': 'application/gzip',
        }),
        arrayBuffer: () => Promise.resolve(mockTarballContent.buffer),
      });

      const result = await client.downloadSkill('@kanyun/test-skill', '1.0.0');

      expect(result.tarball).toBeInstanceOf(Buffer);
      expect(result.integrity).toBe('sha256-mockhash123');

      expect(mockFetch).toHaveBeenCalledWith(
        `${testRegistry}/api/skills/${encodeURIComponent('@kanyun/test-skill')}/versions/1.0.0/download`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${testToken}`,
          }),
        }),
      );
    });

    it('should throw error for non-existent skill', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Skill not found' }),
      });

      await expect(client.downloadSkill('@kanyun/non-existent', '1.0.0')).rejects.toThrow(
        'Skill not found',
      );
    });

    it('should throw error for non-existent version', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Version not found' }),
      });

      await expect(client.downloadSkill('@kanyun/test-skill', '99.0.0')).rejects.toThrow(
        'Version not found',
      );
    });

    it('should handle public registry skill (no scope)', async () => {
      const mockTarballContent = Buffer.from('mock tarball content');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'x-integrity': 'sha256-hash',
        }),
        arrayBuffer: () => Promise.resolve(mockTarballContent.buffer),
      });

      await client.downloadSkill('public-skill', '1.0.0');

      expect(mockFetch).toHaveBeenCalledWith(
        `${testRegistry}/api/skills/public-skill/versions/1.0.0/download`,
        expect.anything(),
      );
    });
  });

  // ============================================================================
  // verifyIntegrity tests (Step 3.3)
  // ============================================================================

  describe('verifyIntegrity', () => {
    it('should return true for matching integrity', () => {
      const content = Buffer.from('test content');
      // 计算实际的 sha256 hash
      const crypto = require('node:crypto');
      const hash = crypto.createHash('sha256').update(content).digest('base64');
      const expectedIntegrity = `sha256-${hash}`;

      const result = RegistryClient.verifyIntegrity(content, expectedIntegrity);
      expect(result).toBe(true);
    });

    it('should return false for mismatched integrity', () => {
      const content = Buffer.from('test content');
      const wrongIntegrity = 'sha256-wronghash';

      const result = RegistryClient.verifyIntegrity(content, wrongIntegrity);
      expect(result).toBe(false);
    });

    it('should handle empty content', () => {
      const content = Buffer.from('');
      const crypto = require('node:crypto');
      const hash = crypto.createHash('sha256').update(content).digest('base64');
      const expectedIntegrity = `sha256-${hash}`;

      const result = RegistryClient.verifyIntegrity(content, expectedIntegrity);
      expect(result).toBe(true);
    });

    it('should throw error for invalid integrity format', () => {
      const content = Buffer.from('test content');

      // 没有连字符分隔的格式是无效的
      expect(() => RegistryClient.verifyIntegrity(content, 'nohyphen')).toThrow(
        'Invalid integrity format',
      );
    });

    it('should throw error for unsupported algorithm', () => {
      const content = Buffer.from('test content');

      expect(() => RegistryClient.verifyIntegrity(content, 'md5-hash')).toThrow(
        'Unsupported integrity algorithm',
      );
    });
  });

  // ============================================================================
  // getSkillInfo tests (页面发布适配)
  // ============================================================================

  describe('getSkillInfo', () => {
    beforeEach(() => {
      client = new RegistryClient({ registry: testRegistry, token: testToken });
    });

    it('should return skill info with source_type for web-published skill', async () => {
      const mockResponse = {
        success: true,
        data: {
          name: '@kanyun/github-skill',
          description: 'A skill from GitHub',
          source_type: 'github',
          source_url: 'https://github.com/user/repo/tree/main/skills/my-skill',
          publisher_id: 'pub_123',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-15T00:00:00Z',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getSkillInfo('@kanyun/github-skill');

      expect(result.name).toBe('@kanyun/github-skill');
      expect(result.source_type).toBe('github');
      expect(result.source_url).toBe('https://github.com/user/repo/tree/main/skills/my-skill');

      expect(mockFetch).toHaveBeenCalledWith(
        `${testRegistry}/api/skills/${encodeURIComponent('@kanyun/github-skill')}`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should return skill info without source_type for CLI-published skill', async () => {
      const mockResponse = {
        success: true,
        data: {
          name: '@kanyun/cli-skill',
          description: 'A CLI published skill',
          source_type: 'registry',
          publisher_id: 'pub_123',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getSkillInfo('@kanyun/cli-skill');

      expect(result.name).toBe('@kanyun/cli-skill');
      expect(result.source_type).toBe('registry');
      expect(result.source_url).toBeUndefined();
    });

    it('should return skill info for old skill without source_type (backward compat)', async () => {
      // 老的 skill 没有 source_type 字段
      const mockResponse = {
        success: true,
        data: {
          name: '@kanyun/old-skill',
          description: 'An old skill',
          publisher_id: 'pub_123',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getSkillInfo('@kanyun/old-skill');

      expect(result.name).toBe('@kanyun/old-skill');
      expect(result.source_type).toBeUndefined();
    });

    it('should throw RegistryError for non-existent skill', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Skill not found' }),
      });

      await expect(client.getSkillInfo('@kanyun/non-existent')).rejects.toThrow(
        'Skill not found: @kanyun/non-existent',
      );
    });

    it('should throw RegistryError for server error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      });

      await expect(client.getSkillInfo('@kanyun/some-skill')).rejects.toThrow(
        'Internal server error',
      );
    });

    it('should use fallback error message when no error in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(client.getSkillInfo('@kanyun/some-skill')).rejects.toThrow(
        'Failed to get skill info',
      );
    });
  });

  // ============================================================================
  // calculateIntegrity tests (Step 3.3)
  // ============================================================================

  describe('calculateIntegrity', () => {
    it('should calculate sha256 integrity for content', () => {
      const content = Buffer.from('test content');
      const integrity = RegistryClient.calculateIntegrity(content);

      expect(integrity).toMatch(/^sha256-[A-Za-z0-9+/]+=*$/);
    });

    it('should return consistent result for same content', () => {
      const content = Buffer.from('consistent content');

      const integrity1 = RegistryClient.calculateIntegrity(content);
      const integrity2 = RegistryClient.calculateIntegrity(content);

      expect(integrity1).toBe(integrity2);
    });

    it('should return different result for different content', () => {
      const content1 = Buffer.from('content 1');
      const content2 = Buffer.from('content 2');

      const integrity1 = RegistryClient.calculateIntegrity(content1);
      const integrity2 = RegistryClient.calculateIntegrity(content2);

      expect(integrity1).not.toBe(integrity2);
    });
  });
});
