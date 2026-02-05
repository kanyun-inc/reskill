/**
 * RegistryClient - Interact with reskill registry API
 *
 * Handles authentication, publishing, and downloading skills from the registry.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { pack } from 'tar-stream';
import type { SkillInfo } from '../types/index.js';
import { getShortName } from '../utils/registry-scope.js';
import type { PublishPayload } from './publisher.js';

// ============================================================================
// Types
// ============================================================================

export interface RegistryConfig {
  registry: string;
  token?: string;
}

export interface PublishRequest {
  name: string;
  version: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, unknown>;
  allowed_tools?: string;
  tag?: string;
  tarball: Buffer;
}

export interface PublishResponse {
  success: boolean;
  ok?: boolean;
  error?: string;
  data?: {
    name: string;
    version: string;
    integrity: string;
    tag: string;
  };
}

export interface WhoamiResponse {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    handle: string;
  };
}

export interface LoginCliResponse {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    handle: string;
    email?: string;
  };
}

export interface SkillMetadataResponse {
  name: string;
  'dist-tags': Record<string, string>;
  versions?: Record<string, unknown>;
  error?: string;
}

export interface DownloadResult {
  tarball: Buffer;
  integrity: string;
}

export class RegistryError extends Error {
  public readonly statusCode?: number;
  public readonly response?: unknown;

  constructor(message: string, statusCode?: number, response?: unknown) {
    super(message);
    this.name = 'RegistryError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

// ============================================================================
// RegistryClient Class
// ============================================================================

export class RegistryClient {
  private config: RegistryConfig;

  constructor(config: RegistryConfig) {
    this.config = config;
  }

  /**
   * Get authorization headers
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'reskill/1.0',
      'X-Client-Type': 'cli',
    };

    if (this.config.token) {
      headers.Authorization = `Bearer ${this.config.token}`;
    }

    return headers;
  }

  /**
   * Get current user info (whoami)
   */
  async whoami(): Promise<WhoamiResponse> {
    const url = `${this.config.registry}/api/auth/me`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const data = (await response.json()) as WhoamiResponse;

    if (!response.ok) {
      throw new RegistryError(
        data.error || `Whoami failed: ${response.status}`,
        response.status,
        data,
      );
    }

    return data;
  }

  /**
   * CLI login - verify token and get user info
   *
   * Calls POST /api/auth/login-cli to validate the token and retrieve user information.
   * This is the preferred method for CLI authentication.
   *
   * @returns User information if authentication succeeds
   * @throws RegistryError if authentication fails
   */
  async loginCli(): Promise<LoginCliResponse> {
    const url = `${this.config.registry}/api/auth/login-cli`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    const data = (await response.json()) as LoginCliResponse;

    if (!response.ok) {
      throw new RegistryError(
        data.error || `Login failed: ${response.status}`,
        response.status,
        data,
      );
    }

    return data;
  }

  /**
   * Create tarball from skill files
   *
   * @param skillPath - Path to the skill directory
   * @param files - List of relative file paths to include
   * @param shortName - Optional: if provided, use as top-level directory in tarball
   *                    (e.g., 'my-skill' -> 'my-skill/SKILL.md')
   */
  async createTarball(skillPath: string, files: string[], shortName?: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const tarPack = pack();

      // Pipe through gzip
      const gzip = zlib.createGzip();

      gzip.on('data', (chunk: Buffer) => chunks.push(chunk));
      gzip.on('end', () => resolve(Buffer.concat(chunks)));
      gzip.on('error', reject);

      tarPack.pipe(gzip);

      // Add files to tarball
      for (const file of files) {
        const filePath = path.join(skillPath, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath);
          const stat = fs.statSync(filePath);

          // 如果提供了 shortName，则在路径前添加顶层目录
          const entryName = shortName ? `${shortName}/${file}` : file;

          tarPack.entry(
            {
              name: entryName,
              size: content.length,
              mode: stat.mode,
              mtime: stat.mtime,
            },
            content,
          );
        }
      }

      tarPack.finalize();
    });
  }

  // ============================================================================
  // Skill Info Methods (页面发布适配)
  // ============================================================================

  /**
   * 获取 skill 基本信息（包含 source_type）
   * 用于 install 命令判断安装逻辑分支
   *
   * @param skillName - 完整名称，如 @kanyun/my-skill
   * @returns Skill 基本信息
   * @throws RegistryError 如果 skill 不存在或请求失败
   */
  async getSkillInfo(skillName: string): Promise<SkillInfo> {
    const url = `${this.config.registry}/api/skills/${encodeURIComponent(skillName)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };

      // 404 时给出明确的 skill 不存在错误
      if (response.status === 404) {
        throw new RegistryError(`Skill not found: ${skillName}`, response.status, data);
      }

      throw new RegistryError(
        data.error || `Failed to get skill info: ${response.statusText}`,
        response.status,
        data,
      );
    }

    // API 返回格式: { success: true, data: { ... } }
    const responseData = (await response.json()) as {
      success?: boolean;
      data?: SkillInfo;
    };

    return responseData.data || (responseData as unknown as SkillInfo);
  }

  // ============================================================================
  // Download Methods (Step 3.3)
  // ============================================================================

  /**
   * Resolve a tag (like "latest" or "beta") to an actual version number
   *
   * @param skillName - Full skill name (e.g., "@kanyun/test-skill" or "public-skill")
   * @param tagOrVersion - Tag name or semver version (defaults to "latest")
   * @returns Resolved version number
   * @throws RegistryError if skill or tag not found
   *
   * @example
   * await client.resolveVersion('@kanyun/test-skill', 'latest') // '2.4.5'
   * await client.resolveVersion('@kanyun/test-skill', '2.4.5') // '2.4.5' (直接返回)
   */
  async resolveVersion(skillName: string, tagOrVersion?: string): Promise<string> {
    const version = tagOrVersion || 'latest';

    // 如果是 semver 版本号，直接返回
    if (/^\d+\.\d+\.\d+/.test(version)) {
      return version;
    }

    // 否则视为 tag，需要查询 dist-tags
    const url = `${this.config.registry}/api/skills/${encodeURIComponent(skillName)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new RegistryError(
        data.error || `Failed to fetch skill metadata: ${response.status}`,
        response.status,
        data,
      );
    }

    // API 返回格式: { success: true, data: { dist_tags: [{ tag, version }] } }
    const responseData = (await response.json()) as {
      success?: boolean;
      data?: {
        dist_tags?: Array<{ tag: string; version: string }>;
      };
      // 兼容 npm 风格的 dist-tags
      'dist-tags'?: Record<string, string>;
    };

    // 优先使用 npm 风格的 dist-tags（如果存在）
    if (responseData['dist-tags']) {
      const resolvedVersion = responseData['dist-tags'][version];
      if (resolvedVersion) {
        return resolvedVersion;
      }
    }

    // 使用 reskill-app 的 dist_tags 数组格式
    const distTags = responseData.data?.dist_tags;
    if (distTags && Array.isArray(distTags)) {
      const tagEntry = distTags.find((t) => t.tag === version);
      if (tagEntry) {
        return tagEntry.version;
      }
    }

    throw new RegistryError(`Tag '${version}' not found for skill ${skillName}`);
  }

  /**
   * Download a skill tarball from the registry
   *
   * @param skillName - Full skill name (e.g., "@kanyun/test-skill" or "public-skill")
   * @param version - Version number to download
   * @returns Downloaded tarball and its integrity hash
   * @throws RegistryError if skill or version not found
   *
   * @example
   * const { tarball, integrity } = await client.downloadSkill('@kanyun/test-skill', '1.0.0');
   */
  async downloadSkill(skillName: string, version: string): Promise<DownloadResult> {
    const url = `${this.config.registry}/api/skills/${encodeURIComponent(skillName)}/versions/${version}/download`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new RegistryError(
        data.error || `Download failed: ${response.status}`,
        response.status,
        data,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const tarball = Buffer.from(arrayBuffer);
    const integrity = response.headers.get('x-integrity') || '';

    return { tarball, integrity };
  }

  // ============================================================================
  // Integrity Methods (Step 3.3)
  // ============================================================================

  /**
   * Calculate SHA256 integrity hash for content
   *
   * @param content - Content buffer to hash
   * @returns Integrity string in format "sha256-{base64hash}"
   *
   * @example
   * RegistryClient.calculateIntegrity(buffer) // 'sha256-abc123...'
   */
  static calculateIntegrity(content: Buffer): string {
    const hash = crypto.createHash('sha256').update(content).digest('base64');
    return `sha256-${hash}`;
  }

  /**
   * Verify content matches expected integrity hash
   *
   * @param content - Content buffer to verify
   * @param expectedIntegrity - Expected integrity string (e.g., "sha256-{hash}")
   * @returns true if integrity matches, false otherwise
   * @throws Error if integrity format is invalid or algorithm is unsupported
   *
   * @example
   * RegistryClient.verifyIntegrity(buffer, 'sha256-abc123...') // true or false
   */
  static verifyIntegrity(content: Buffer, expectedIntegrity: string): boolean {
    // 解析 integrity 格式: algorithm-hash
    const match = expectedIntegrity.match(/^(\w+)-(.+)$/);
    if (!match) {
      throw new Error(`Invalid integrity format: ${expectedIntegrity}`);
    }

    const [, algorithm, expectedHash] = match;

    // 只支持 sha256 和 sha512
    if (algorithm !== 'sha256' && algorithm !== 'sha512') {
      throw new Error(`Unsupported integrity algorithm: ${algorithm}`);
    }

    const actualHash = crypto.createHash(algorithm).update(content).digest('base64');
    return actualHash === expectedHash;
  }

  // ============================================================================
  // Publish Methods
  // ============================================================================

  /**
   * Publish a skill to the registry
   */
  async publish(
    skillName: string,
    payload: PublishPayload,
    skillPath: string,
    options: { tag?: string } = {},
  ): Promise<PublishResponse> {
    const url = `${this.config.registry}/api/skills/publish`;

    // 提取短名称作为 tarball 顶层目录（不含 scope 前缀）
    const shortName = getShortName(skillName);

    // Create tarball with short name as top-level directory
    const tarball = await this.createTarball(skillPath, payload.files, shortName);

    // Build FormData
    const formData = new FormData();
    formData.append('name', skillName);
    formData.append('version', payload.version);
    formData.append('description', payload.description);

    if (payload.skillJson.license) {
      formData.append('license', payload.skillJson.license);
    }

    if (payload.skillMd?.compatibility) {
      formData.append('compatibility', payload.skillMd.compatibility);
    }

    // Add metadata
    const metadata: Record<string, unknown> = {
      ...(payload.keywords && { keywords: payload.keywords }),
      ...(payload.compatibility && { compatibility: payload.compatibility }),
      repositoryUrl: payload.repositoryUrl,
      sourceRef: payload.sourceRef,
      gitRef: payload.gitRef,
      gitCommit: payload.gitCommit,
    };
    formData.append('metadata', JSON.stringify(metadata));

    if (payload.skillMd?.allowedTools) {
      formData.append('allowed_tools', payload.skillMd.allowedTools.join(' '));
    }

    if (options.tag) {
      formData.append('tag', options.tag);
    }

    // Append tarball as Blob
    const tarballBlob = new Blob([tarball], { type: 'application/gzip' });
    formData.append('tarball', tarballBlob, `${skillName.replace('/', '-')}.tgz`);

    // Send request
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    });

    const data = (await response.json()) as PublishResponse;

    if (!response.ok) {
      throw new RegistryError(
        data.error || `Publish failed: ${response.status}`,
        response.status,
        data,
      );
    }

    return data;
  }
}

export default RegistryClient;
