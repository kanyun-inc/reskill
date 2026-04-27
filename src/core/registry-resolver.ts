/**
 * Registry Resolver (Step 5.1)
 *
 * Resolves skill references from npm-style registries:
 * - Private registry: @scope/name[@version] (e.g., @kanyun/planning-with-files@2.4.5)
 * - Public registry: name[@version] (e.g., my-skill@1.0.0)
 *
 * Uses RegistryClient to download and verify skills.
 */

import { logger } from '../utils/logger.js';
import {
  getRegistryUrl,
  getShortName,
  type ParsedSkillIdentifier,
  parseSkillIdentifier,
} from '../utils/registry-scope.js';
import { extractTarballBuffer, getTarballTopDir } from './extractor.js';
import { RegistryClient } from './registry-client.js';

// ============================================================================
// Types
// ============================================================================

export interface RegistryResolveResult {
  /** Parsed skill identifier */
  parsed: ParsedSkillIdentifier;
  /** Short skill name (without scope) */
  shortName: string;
  /** Resolved version */
  version: string;
  /** Registry URL */
  registryUrl: string;
  /** Downloaded tarball buffer */
  tarball: Buffer;
  /** Integrity hash from server */
  integrity: string;
}

// ============================================================================
// RegistryResolver Class
// ============================================================================

export class RegistryResolver {
  /**
   * Check if a reference is a registry source (not Git or HTTP)
   *
   * Registry formats:
   * - @scope/name[@version] - private registry
   * - name[@version] - public registry (if not matching other formats)
   *
   * Explicitly excluded:
   * - Git SSH: git@github.com:user/repo.git
   * - Git HTTPS: https://github.com/user/repo.git
   * - GitHub web: https://github.com/user/repo/tree/...
   * - HTTP/OSS: https://example.com/skill.tar.gz
   * - Registry shorthand: github:user/repo, gitlab:org/repo
   */
  static isRegistryRef(ref: string): boolean {
    // Exclude Git SSH format (git@...)
    if (ref.startsWith('git@') || ref.startsWith('git://')) {
      return false;
    }

    // Exclude URLs ending with .git
    if (ref.includes('.git')) {
      return false;
    }

    // Exclude HTTP/HTTPS/OSS URLs
    if (
      ref.startsWith('http://') ||
      ref.startsWith('https://') ||
      ref.startsWith('oss://') ||
      ref.startsWith('s3://')
    ) {
      return false;
    }

    // Exclude registry shorthand format (github:, gitlab:, custom.com:)
    // These follow "registry:owner/repo" pattern, not "@scope/name"
    if (/^[a-zA-Z0-9.-]+:[^@]/.test(ref)) {
      return false;
    }

    // Check for @scope/name format (private registry)
    if (ref.startsWith('@') && ref.includes('/')) {
      // @scope/name or @scope/name@version
      const scopeNamePattern = /^@[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+(@[a-zA-Z0-9._-]+)?$/;
      return scopeNamePattern.test(ref);
    }

    // Check for simple name or name@version format (public registry)
    // Simple names contain only letters, digits, hyphens, underscores, and dots
    const namePattern = /^[a-zA-Z0-9._-]+(@[a-zA-Z0-9._-]+)?$/;
    return namePattern.test(ref);
  }

  /**
   * Resolve a registry skill reference
   *
   * @param ref - Skill reference (e.g., "@kanyun/planning-with-files@2.4.5" or "my-skill@latest")
   * @param overrideRegistryUrl - Optional registry URL override (bypasses scope-based lookup)
   * @param token - Optional auth token for private skill access
   * @returns Resolved skill information including downloaded tarball
   *
   * @example
   * const result = await resolver.resolve('@kanyun/planning-with-files@2.4.5');
   * console.log(result.shortName); // 'planning-with-files'
   * console.log(result.version); // '2.4.5'
   */
  async resolve(
    ref: string,
    overrideRegistryUrl?: string,
    token?: string,
  ): Promise<RegistryResolveResult> {
    // 1. Parse skill identifier
    const parsed = parseSkillIdentifier(ref);
    const shortName = getShortName(parsed.fullName);

    // 2. Get registry URL (CLI override takes precedence)
    const registryUrl = overrideRegistryUrl || getRegistryUrl(parsed.scope);

    // 3. Create client and resolve version
    const client = new RegistryClient({ registry: registryUrl, token });
    const version = await client.resolveVersion(parsed.fullName, parsed.version);

    // 4. Download tarball
    const { tarball, integrity } = await client.downloadSkill(parsed.fullName, version);

    // 5. Verify integrity
    //
    // The server contract (rush-v2 server-api.spec.md §3.2a/3.2b) explicitly
    // returns an empty `x-integrity` header for local-mode publishes — i.e.
    // skills uploaded as a multipart tarball via the Web UI store integrity
    // as ''. Skip verification in that case rather than failing install.
    if (integrity) {
      const isValid = RegistryClient.verifyIntegrity(tarball, integrity);
      if (!isValid) {
        throw new Error(`Integrity verification failed for ${ref}`);
      }
    } else {
      logger.debug(
        `Server returned empty integrity for ${ref}; skipping verification (expected for local-mode publishes).`,
      );
    }

    return {
      parsed,
      shortName,
      version,
      registryUrl,
      tarball,
      integrity,
    };
  }

  /**
   * Extract tarball to a target directory
   *
   * @param tarball - Tarball buffer
   * @param destDir - Destination directory
   * @returns Path to the extracted skill directory
   */
  async extract(tarball: Buffer, destDir: string): Promise<string> {
    await extractTarballBuffer(tarball, destDir);

    // Get top-level directory name (i.e. skill name)
    const topDir = await getTarballTopDir(tarball);
    if (topDir) {
      return `${destDir}/${topDir}`;
    }

    return destDir;
  }
}
