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
import type { GroupDetail, GroupMember, GroupRole, SkillGroup, SkillInfo } from '../types/index.js';
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

export interface SearchResultItem {
  /** Full skill name (e.g., "@kanyun/planning-with-files") */
  name: string;
  /** Description */
  description?: string;
  /** Latest version */
  latest_version?: string;
  /** Keywords (parsed from metadata_json) */
  keywords?: string[];
  /** Publisher info */
  publisher?: { handle: string };
  /** Last updated time */
  updated_at?: string;
}

export interface SearchPagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface SearchResponse {
  /** Whether request succeeded */
  success: boolean;
  /** Error message (if failed) */
  error?: string;
  /** Search results */
  data?: SearchResultItem[];
  /** Pagination metadata */
  meta?: {
    pagination?: SearchPagination;
  };
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
   * Get API base URL (registry + /api)
   *
   * All registries use the unified '/api' prefix.
   *
   * @returns Base URL for API calls, e.g., 'https://example.com/api'
   */
  private getApiBase(): string {
    const registry = this.config.registry.endsWith('/')
      ? this.config.registry.slice(0, -1)
      : this.config.registry;
    return `${registry}/api`;
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
    const url = `${this.getApiBase()}/skill-auth/me`;

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
   * Calls POST /api/skill-auth/login-cli to validate the token and retrieve user information.
   * This is the preferred method for CLI authentication.
   *
   * @returns User information if authentication succeeds
   * @throws RegistryError if authentication fails
   */
  async loginCli(): Promise<LoginCliResponse> {
    const url = `${this.getApiBase()}/skill-auth/login-cli`;

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

          // Prepend shortName as top-level directory if provided
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
  // Skill Info Methods (web-published skill support)
  // ============================================================================

  /**
   * Get basic skill info (including source_type).
   * Used by the install command to determine the installation logic branch.
   *
   * @param skillName - Full skill name, e.g., @kanyun/my-skill
   * @returns Basic skill information
   * @throws RegistryError if skill not found or request failed
   */
  async getSkillInfo(skillName: string): Promise<SkillInfo> {
    const url = `${this.getApiBase()}/skills/${encodeURIComponent(skillName)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };

      // Return a clear "not found" error for 404 responses
      if (response.status === 404) {
        throw new RegistryError(`Skill not found: ${skillName}`, response.status, data);
      }

      throw new RegistryError(
        data.error || `Failed to get skill info: ${response.statusText}`,
        response.status,
        data,
      );
    }

    // API response format: { success: true, data: { ... } }
    const responseData = (await response.json()) as {
      success?: boolean;
      data?: SkillInfo;
    };

    return responseData.data || (responseData as unknown as SkillInfo);
  }

  // ============================================================================
  // Search Methods
  // ============================================================================

  /**
   * Search for skills in the registry
   *
   * @param query - Search query string
   * @param options - Search options (limit, offset)
   * @returns Array of matching skills
   * @throws RegistryError if the request fails
   *
   * @example
   * const results = await client.search('typescript');
   * const results = await client.search('planning', { limit: 5 });
   */
  async search(
    query: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const params = new URLSearchParams({ q: query });

    if (options.limit !== undefined) {
      params.set('limit', String(options.limit));
    }
    if (options.offset !== undefined) {
      params.set('offset', String(options.offset));
    }

    const url = `${this.getApiBase()}/skills?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new RegistryError(
        data.error || `Search failed: ${response.status}`,
        response.status,
        data,
      );
    }

    const data = (await response.json()) as SearchResponse;

    return {
      items: data.data || [],
      total: data.meta?.pagination?.totalItems ?? data.data?.length ?? 0,
    };
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
   * await client.resolveVersion('@kanyun/test-skill', '2.4.5') // '2.4.5' (returned as-is)
   */
  async resolveVersion(skillName: string, tagOrVersion?: string): Promise<string> {
    const version = tagOrVersion || 'latest';

    // If it's already a semver version number, return as-is
    if (/^\d+\.\d+\.\d+/.test(version)) {
      return version;
    }

    // Otherwise treat it as a tag and query dist-tags
    const url = `${this.getApiBase()}/skills/${encodeURIComponent(skillName)}`;

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

    // API response format: { success: true, data: { dist_tags: [{ tag, version }] } }
    const responseData = (await response.json()) as {
      success?: boolean;
      data?: {
        dist_tags?: Array<{ tag: string; version: string }>;
      };
      // Also support npm-style dist-tags for compatibility
      'dist-tags'?: Record<string, string>;
    };

    // Prefer npm-style dist-tags if present
    if (responseData['dist-tags']) {
      const resolvedVersion = responseData['dist-tags'][version];
      if (resolvedVersion) {
        return resolvedVersion;
      }
    }

    // Fall back to reskill-app's dist_tags array format
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
    const url = `${this.getApiBase()}/skills/${encodeURIComponent(skillName)}/versions/${version}/download`;

    // Use redirect: 'manual' to capture x-integrity header from 302 responses.
    // The registry returns a 302 redirect to OSS with the integrity header,
    // which would be lost if fetch auto-follows the redirect.
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
      redirect: 'manual',
    });

    // Handle 302 redirect (registry → OSS signed URL)
    if (response.status === 301 || response.status === 302) {
      const integrity = response.headers.get('x-integrity') || '';
      const location = response.headers.get('location');

      if (!location) {
        throw new RegistryError('Missing redirect location in download response', response.status);
      }

      const downloadResponse = await fetch(location);
      if (!downloadResponse.ok) {
        throw new RegistryError(
          `Download from storage failed: ${downloadResponse.status}`,
          downloadResponse.status,
        );
      }

      const arrayBuffer = await downloadResponse.arrayBuffer();
      const tarball = Buffer.from(arrayBuffer);
      return { tarball, integrity };
    }

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new RegistryError(
        data.error || `Download failed: ${response.status}`,
        response.status,
        data,
      );
    }

    // Direct response (no redirect) - read tarball and integrity directly
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
    // Parse integrity format: algorithm-hash
    const match = expectedIntegrity.match(/^(\w+)-(.+)$/);
    if (!match) {
      throw new Error(`Invalid integrity format: ${expectedIntegrity}`);
    }

    const [, algorithm, expectedHash] = match;

    // Only sha256 and sha512 are supported
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
    options: { tag?: string; groupPath?: string } = {},
  ): Promise<PublishResponse> {
    const url = `${this.getApiBase()}/skills/publish`;

    // Extract short name as tarball top-level directory (without scope prefix)
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

    if (options.groupPath) {
      formData.append('group_path', options.groupPath);
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

  // ============================================================================
  // Group Methods
  // ============================================================================

  /**
   * Resolve a human-readable group path to its details.
   *
   * @param groupPath - Human-readable path (e.g., "kanyun/frontend")
   * @returns Group detail with current_user_role if authenticated
   * @throws RegistryError if not found or request failed
   */
  async resolveGroup(groupPath: string): Promise<GroupDetail> {
    const params = new URLSearchParams({ path: groupPath });
    const url = `${this.getApiBase()}/skill-groups/resolve?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new RegistryError(
        data.error || `Group not found: ${groupPath}`,
        response.status,
        data,
      );
    }

    const body = (await response.json()) as { data: GroupDetail };
    return body.data;
  }

  /**
   * List groups visible to the current user.
   *
   * @param options - Filter options (parent_id, visibility)
   * @returns Array of groups
   */
  async listGroups(
    options: { parentId?: string; visibility?: string; flat?: boolean } = {},
  ): Promise<SkillGroup[]> {
    const params = new URLSearchParams();
    if (options.parentId) params.set('parent_id', options.parentId);
    if (options.visibility) params.set('visibility', options.visibility);
    if (options.flat) params.set('flat', 'true');

    const qs = params.toString();
    const url = `${this.getApiBase()}/skill-groups${qs ? `?${qs}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new RegistryError(
        data.error || `Failed to list groups: ${response.status}`,
        response.status,
        data,
      );
    }

    const body = (await response.json()) as { data: SkillGroup[] };
    return body.data;
  }

  /**
   * Create a new skill group.
   *
   * @param input - Group creation parameters
   * @returns Created group
   */
  async createGroup(input: {
    name: string;
    slug: string;
    description?: string;
    visibility?: string;
    parent_id?: string;
  }): Promise<SkillGroup> {
    const url = `${this.getApiBase()}/skill-groups`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new RegistryError(
        data.error || `Failed to create group: ${response.status}`,
        response.status,
        data,
      );
    }

    const body = (await response.json()) as { data: SkillGroup };
    return body.data;
  }

  /**
   * Delete a skill group.
   *
   * @param groupId - Group UUID
   * @param dryRun - If true, only preview what would be deleted
   * @returns Deletion result (affected skills count in dry-run mode)
   */
  async deleteGroup(
    groupId: string,
    dryRun = false,
  ): Promise<{ deleted?: boolean; affected_skills?: number }> {
    const params = dryRun ? '?dry_run=true' : '';
    const url = `${this.getApiBase()}/skill-groups/${groupId}${params}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new RegistryError(
        data.error || `Failed to delete group: ${response.status}`,
        response.status,
        data,
      );
    }

    const body = (await response.json()) as {
      data: { deleted?: boolean; affected_skills?: number };
    };
    return body.data;
  }

  /**
   * List members of a group.
   *
   * @param groupId - Group UUID
   * @returns Array of members
   */
  async listGroupMembers(groupId: string): Promise<GroupMember[]> {
    const url = `${this.getApiBase()}/skill-groups/${groupId}/members`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new RegistryError(
        data.error || `Failed to list members: ${response.status}`,
        response.status,
        data,
      );
    }

    const body = (await response.json()) as { data: GroupMember[] };
    return body.data;
  }

  /**
   * Add members to a group.
   *
   * @param groupId - Group UUID
   * @param userIds - Array of user IDs to add
   * @param role - Role to assign (defaults to 'developer')
   */
  async addGroupMembers(
    groupId: string,
    userIds: string[],
    role: GroupRole = 'developer',
  ): Promise<void> {
    const url = `${this.getApiBase()}/skill-groups/${groupId}/members`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_ids: userIds, role }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new RegistryError(
        data.error || `Failed to add members: ${response.status}`,
        response.status,
        data,
      );
    }
  }

  /**
   * Remove a member from a group.
   *
   * @param groupId - Group UUID
   * @param userId - User ID to remove
   */
  async removeGroupMember(groupId: string, userId: string): Promise<void> {
    const params = new URLSearchParams({ user_id: userId });
    const url = `${this.getApiBase()}/skill-groups/${groupId}/members?${params.toString()}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new RegistryError(
        data.error || `Failed to remove member: ${response.status}`,
        response.status,
        data,
      );
    }
  }

  /**
   * Update a member's role in a group.
   *
   * @param groupId - Group UUID
   * @param userId - User ID to update
   * @param role - New role to assign
   */
  async updateGroupMemberRole(
    groupId: string,
    userId: string,
    role: GroupRole,
  ): Promise<void> {
    const url = `${this.getApiBase()}/skill-groups/${groupId}/members`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId, role }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new RegistryError(
        data.error || `Failed to update member role: ${response.status}`,
        response.status,
        data,
      );
    }
  }
}

export default RegistryClient;
