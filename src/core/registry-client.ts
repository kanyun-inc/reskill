/**
 * RegistryClient - Interact with reskill registry API
 *
 * Handles authentication, publishing, and downloading skills from the registry.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { pack } from 'tar-stream';
import type { PublishPayload } from './publisher.js';

// ============================================================================
// Types
// ============================================================================

export interface RegistryConfig {
  registry: string;
  token?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  error?: string;
  publisher?: {
    id: string;
    handle: string;
    email: string;
    email_verified: boolean;
    created_at: string;
  };
  token?: {
    id: string;
    secret: string;
    name: string;
  };
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
  };
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
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    return headers;
  }

  /**
   * Login to registry
   */
  async login(request: LoginRequest): Promise<LoginResponse> {
    const url = `${this.config.registry}/api/auth/login`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data = await response.json() as LoginResponse;

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
   * Get current user info (whoami)
   */
  async whoami(): Promise<WhoamiResponse> {
    const url = `${this.config.registry}/api/auth/me`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const data = await response.json() as WhoamiResponse;

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
   * Create tarball from skill files
   */
  async createTarball(skillPath: string, files: string[]): Promise<Buffer> {
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

          tarPack.entry(
            {
              name: file,
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

    // Create tarball
    const tarball = await this.createTarball(skillPath, payload.files);

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

    const data = await response.json() as PublishResponse;

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
