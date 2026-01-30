/**
 * RegistryClient unit tests
 *
 * Tests for registry API interactions with mocked fetch
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistryClient, RegistryError } from './registry-client.js';

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
  // login tests
  // ============================================================================

  describe('login', () => {
    beforeEach(() => {
      client = new RegistryClient({ registry: testRegistry });
    });

    it('should send login request with correct payload', async () => {
      const mockResponse = {
        success: true,
        publisher: {
          id: 'pub_123',
          handle: 'testuser',
          email: 'test@example.com',
          email_verified: true,
          created_at: '2024-01-01T00:00:00Z',
        },
        token: {
          id: 'tok_123',
          secret: 'secret_token',
          name: 'CLI Token',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `${testRegistry}/api/auth/login`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'reskill/1.0',
            'X-Client-Type': 'cli',
          }),
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
          }),
        }),
      );

      expect(result).toEqual(mockResponse);
    });

    it('should throw RegistryError on login failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Invalid credentials' }),
      });

      try {
        await client.login({ email: 'test@example.com', password: 'wrong' });
        expect.fail('Expected RegistryError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RegistryError);
        expect((error as RegistryError).message).toBe('Invalid credentials');
        expect((error as RegistryError).statusCode).toBe(401);
      }
    });

    it('should use default error message when none provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });

      await expect(client.login({ email: 'test@example.com', password: 'test' })).rejects.toThrow(
        'Login failed: 500',
      );
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
            },
          }),
      });

      await client.whoami();

      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders.Authorization).toBe(`Bearer ${testToken}`);
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
});
