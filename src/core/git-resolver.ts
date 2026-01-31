import * as semver from 'semver';
import type { ParsedSkillRef, ParsedVersion, RegistryConfig } from '../types/index.js';
import {
  getDefaultBranch,
  getLatestTag,
  getRemoteTags,
  isGitUrl,
  parseGitUrl,
} from '../utils/git.js';
import { DEFAULT_REGISTRIES } from './config-loader.js';

/**
 * Registry resolver function type
 * Takes a registry name and returns the base URL
 */
export type RegistryResolver = (registryName: string) => string;

/**
 * GitResolver - Parse skill references and versions
 *
 * Reference formats:
 *   Full: <registry>:<owner>/<repo>@<version>
 *   Short: <owner>/<repo>@<version>
 *   Git URL: git@github.com:user/repo.git[@version]
 *   HTTPS: https://github.com/user/repo.git[@version]
 *
 * Version formats:
 *   - @v1.0.0       Exact version
 *   - @latest       Latest tag
 *   - @^2.0.0       Semver range
 *   - @branch:dev   Branch
 *   - @commit:abc   Commit hash
 *   - (none)        Default branch
 */
export class GitResolver {
  private readonly defaultRegistry: string;
  private readonly customRegistries: RegistryConfig;
  private readonly registryResolver?: RegistryResolver;

  /**
   * Create a GitResolver instance
   *
   * @param defaultRegistry - Default registry name (defaults to 'github')
   * @param registries - Custom registry configuration (name -> URL mapping)
   * @param registryResolver - Optional custom registry resolver function
   */
  constructor(
    defaultRegistry: string = 'github',
    registries?: RegistryConfig,
    registryResolver?: RegistryResolver,
  ) {
    this.defaultRegistry = defaultRegistry;
    this.customRegistries = registries ?? {};
    this.registryResolver = registryResolver;
  }

  /**
   * Get registry URL by name
   *
   * Resolution order:
   * 1. Custom registry resolver function (if provided)
   * 2. Custom registries from configuration
   * 3. Well-known registries (github, gitlab)
   * 4. Assumes it's a custom domain (https://{registryName})
   */
  getRegistryUrl(registryName: string): string {
    // Use custom resolver if provided
    if (this.registryResolver) {
      return this.registryResolver(registryName);
    }

    // Check custom registries from configuration
    if (this.customRegistries[registryName]) {
      return this.customRegistries[registryName];
    }

    // Check well-known registries
    if (DEFAULT_REGISTRIES[registryName]) {
      return DEFAULT_REGISTRIES[registryName];
    }

    // Assume it's a custom domain
    return `https://${registryName}`;
  }

  /**
   * Parse skill reference string
   *
   * Supported formats:
   * - Short: owner/repo[@version]
   * - Full: registry:owner/repo[@version]
   * - SSH URL: git@github.com:user/repo.git[@version]
   * - HTTPS URL: https://github.com/user/repo.git[@version]
   * - Monorepo: git@github.com:org/repo.git/subpath[@version]
   */
  parseRef(ref: string): ParsedSkillRef {
    const raw = ref;

    // First check if it's a Git URL (SSH, HTTPS, git://)
    // For Git URLs, need special handling for version separator
    // Format: git@host:user/repo.git[@version] or git@host:user/repo.git/subpath[@version]
    if (isGitUrl(ref)) {
      return this.parseGitUrlRef(ref);
    }

    // Standard format parsing for non-Git URLs
    let remaining = ref;
    let registry = this.defaultRegistry;
    let version: string | undefined;

    // Check for registry prefix (github:, gitlab:, custom.com:)
    const registryMatch = remaining.match(/^([a-zA-Z0-9.-]+):(.+)$/);
    if (registryMatch) {
      registry = registryMatch[1];
      remaining = registryMatch[2];
    }

    // Separate version part
    const atIndex = remaining.lastIndexOf('@');
    if (atIndex > 0) {
      version = remaining.slice(atIndex + 1);
      remaining = remaining.slice(0, atIndex);
    }

    // Parse owner/repo and possible subPath
    // E.g.: user/repo or org/monorepo/skills/pdf
    const parts = remaining.split('/');

    if (parts.length < 2) {
      throw new Error(`Invalid skill reference: ${ref}. Expected format: owner/repo[@version]`);
    }

    const owner = parts[0];
    const repo = parts[1];
    const subPath = parts.length > 2 ? parts.slice(2).join('/') : undefined;

    return {
      registry,
      owner,
      repo,
      subPath,
      version,
      raw,
    };
  }

  /**
   * Parse Git URL format reference
   *
   * Supported formats:
   * - git@github.com:user/repo.git
   * - git@github.com:user/repo.git@v1.0.0
   * - git@github.com:user/repo.git/subpath@v1.0.0
   * - https://github.com/user/repo.git
   * - https://github.com/user/repo.git@v1.0.0
   * - https://github.com/user/repo/tree/branch/path (GitHub web URL)
   * - file:///path/to/repo (local file URL for testing)
   * - file:///path/to/repo/subpath@version (local file URL with subpath)
   */
  private parseGitUrlRef(ref: string): ParsedSkillRef {
    const raw = ref;
    let gitUrl = ref;
    let version: string | undefined;
    let subPath: string | undefined;

    // Check for GitHub/GitLab web URL format: https://github.com/user/repo/tree/branch/path
    const webUrlMatch = ref.match(/^(https?:\/\/[^/]+)\/([^/]+)\/([^/]+)\/(tree|blob|raw)\/([^/]+)(?:\/(.+))?$/);
    if (webUrlMatch) {
      const [, baseUrl, owner, repo, , branch, path] = webUrlMatch;
      
      // Build standard Git URL
      gitUrl = `${baseUrl}/${owner}/${repo}.git`;
      
      // Extract branch as version
      version = `branch:${branch}`;
      
      // Extract subpath
      subPath = path;
      
      return {
        registry: new URL(baseUrl).hostname,
        owner,
        repo,
        subPath,
        version,
        raw,
        gitUrl,
      };
    }

    // For URLs ending with .git, first check for /subpath@version or @version
    // Format: url.git/subpath@version or url.git@version
    const gitSuffixIndex = ref.indexOf('.git');
    if (gitSuffixIndex !== -1) {
      const afterGit = ref.slice(gitSuffixIndex + 4);

      if (afterGit) {
        // Check version (@version)
        const atIndex = afterGit.lastIndexOf('@');
        if (atIndex !== -1) {
          version = afterGit.slice(atIndex + 1);
          const pathPart = afterGit.slice(0, atIndex);
          if (pathPart.startsWith('/')) {
            subPath = pathPart.slice(1);
          }
        } else if (afterGit.startsWith('/')) {
          subPath = afterGit.slice(1);
        }

        // Extract clean Git URL (without subpath and version)
        gitUrl = ref.slice(0, gitSuffixIndex + 4);
      }
    } else {
      // URL without .git suffix, try to separate version
      const atIndex = ref.lastIndexOf('@');
      // For SSH URL, @ at the beginning is normal (git@...), need to skip
      if (atIndex > 4) {
        // Make sure it's not the @ in git@host
        version = ref.slice(atIndex + 1);
        gitUrl = ref.slice(0, atIndex);
      }
    }

    // Parse Git URL to get host, owner, repo
    const parsed = parseGitUrl(gitUrl);
    if (!parsed) {
      throw new Error(
        `Invalid Git URL: ${ref}. Expected format: git@host:owner/repo.git or https://host/owner/repo.git`,
      );
    }

    return {
      registry: parsed.host,
      owner: parsed.owner,
      repo: parsed.repo,
      subPath,
      version,
      raw,
      gitUrl,
    };
  }

  /**
   * Parse version specification
   */
  parseVersion(versionSpec?: string): ParsedVersion {
    if (!versionSpec) {
      return { type: 'branch', value: 'main', raw: '' };
    }

    const raw = versionSpec;

    // latest
    if (versionSpec === 'latest') {
      return { type: 'latest', value: 'latest', raw };
    }

    // branch:xxx
    if (versionSpec.startsWith('branch:')) {
      return { type: 'branch', value: versionSpec.slice(7), raw };
    }

    // commit:xxx
    if (versionSpec.startsWith('commit:')) {
      return { type: 'commit', value: versionSpec.slice(7), raw };
    }

    // semver range (^, ~, >, <, etc.)
    if (/^[\^~><]/.test(versionSpec)) {
      return { type: 'range', value: versionSpec, raw };
    }

    // exact version (v1.0.0 or 1.0.0)
    return { type: 'exact', value: versionSpec, raw };
  }

  /**
   * Build repository URL
   *
   * If parsed contains gitUrl, return it directly;
   * Otherwise build HTTPS URL from registry and owner/repo
   */
  buildRepoUrl(parsed: ParsedSkillRef): string {
    // If has complete Git URL, return directly
    if (parsed.gitUrl) {
      return parsed.gitUrl;
    }
    // Use our registry resolver to get the base URL
    const baseUrl = this.getRegistryUrl(parsed.registry);
    return `${baseUrl}/${parsed.owner}/${parsed.repo}`;
  }

  /**
   * Resolve version and get specific ref (tag name or commit)
   */
  async resolveVersion(
    repoUrl: string,
    versionSpec: ParsedVersion,
  ): Promise<{ ref: string; commit?: string }> {
    switch (versionSpec.type) {
      case 'exact':
        // Use specified tag directly
        return { ref: versionSpec.value };

      case 'latest': {
        // Get latest tag
        const latestTag = await getLatestTag(repoUrl);
        if (!latestTag) {
          // No tag, use default branch
          const defaultBranch = await getDefaultBranch(repoUrl);
          return { ref: defaultBranch };
        }
        return { ref: latestTag.name, commit: latestTag.commit };
      }

      case 'range': {
        // Get all tags, find latest version satisfying semver range
        const tags = await getRemoteTags(repoUrl);
        const matchingTags = tags.filter((tag) => {
          const version = tag.name.replace(/^v/, '');
          return semver.satisfies(version, versionSpec.value);
        });

        if (matchingTags.length === 0) {
          throw new Error(`No version found matching ${versionSpec.raw} for ${repoUrl}`);
        }

        // Sort by version, get latest
        matchingTags.sort((a, b) => {
          const aVer = a.name.replace(/^v/, '');
          const bVer = b.name.replace(/^v/, '');
          return semver.compare(bVer, aVer);
        });

        return { ref: matchingTags[0].name, commit: matchingTags[0].commit };
      }

      case 'branch':
        return { ref: versionSpec.value };

      case 'commit':
        return { ref: versionSpec.value, commit: versionSpec.value };

      default:
        throw new Error(`Unknown version type: ${(versionSpec as ParsedVersion).type}`);
    }
  }

  /**
   * Full resolution: from reference string to clone-ready information
   */
  async resolve(ref: string): Promise<{
    parsed: ParsedSkillRef;
    repoUrl: string;
    ref: string;
    commit?: string;
  }> {
    const parsed = this.parseRef(ref);
    const repoUrl = this.buildRepoUrl(parsed);
    const versionSpec = this.parseVersion(parsed.version);
    const resolved = await this.resolveVersion(repoUrl, versionSpec);

    return {
      parsed,
      repoUrl,
      ref: resolved.ref,
      commit: resolved.commit,
    };
  }
}

export default GitResolver;
