import { exec, execSync } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Git utilities
 */

/**
 * SSH command with auto-accept for new host keys
 * Uses StrictHostKeyChecking=accept-new which:
 * - Automatically accepts keys for hosts not in known_hosts
 * - Still rejects connections if a known host's key has changed (security)
 */
export const GIT_SSH_COMMAND = 'ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes';

/**
 * Get environment variables for git commands that access remote repositories
 * Configures SSH to auto-accept new host keys and disables interactive prompts
 */
export function getGitEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_SSH_COMMAND,
    // Disable interactive prompts for HTTPS as well
    GIT_TERMINAL_PROMPT: '0',
  };
}

export interface GitTag {
  name: string;
  commit: string;
}

/**
 * Custom error class for Git clone failures
 * Provides helpful tips for private repository authentication
 */
export class GitCloneError extends Error {
  public readonly repoUrl: string;
  public readonly originalError: Error;
  public readonly isAuthError: boolean;
  public readonly urlType: 'ssh' | 'https' | 'unknown';

  constructor(repoUrl: string, originalError: Error) {
    const isAuthError = GitCloneError.isAuthenticationError(originalError.message);
    const urlType = GitCloneError.detectUrlType(repoUrl);

    let message = `Failed to clone repository: ${repoUrl}`;
    if (isAuthError) {
      message += '\n\nTip: For private repos, ensure git credentials are configured:';
      if (urlType === 'ssh') {
        message += '\n  - Check ~/.ssh/id_rsa or ~/.ssh/id_ed25519';
        message += '\n  - Ensure SSH key is added to your Git hosting service';
      } else {
        // HTTPS or unknown
        message += "\n  - Run 'git config --global credential.helper store'";
        message += '\n  - Or use a personal access token in the URL';
      }
    }

    super(message);
    this.name = 'GitCloneError';
    this.repoUrl = repoUrl;
    this.originalError = originalError;
    this.isAuthError = isAuthError;
    this.urlType = urlType;
  }

  /**
   * Detect URL type from repository URL
   */
  static detectUrlType(url: string): 'ssh' | 'https' | 'unknown' {
    if (url.startsWith('git@') || url.startsWith('ssh://')) {
      return 'ssh';
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return 'https';
    }
    return 'unknown';
  }

  /**
   * Check if an error message indicates an authentication problem
   */
  static isAuthenticationError(message: string): boolean {
    const authPatterns = [
      /permission denied/i,
      /could not read from remote/i,
      /authentication failed/i,
      /fatal: repository.*not found/i,
      /host key verification failed/i,
      /access denied/i,
      /unauthorized/i,
      /403/,
      /401/,
    ];

    return authPatterns.some((pattern) => pattern.test(message));
  }
}

/**
 * Execute git command synchronously
 */
export function gitSync(args: string[], cwd?: string): string {
  const result = execSync(`git ${args.join(' ')}`, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: getGitEnv(),
  });
  return result.trim();
}

/**
 * Execute git command asynchronously
 */
export async function git(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await execAsync(`git ${args.join(' ')}`, {
    cwd,
    encoding: 'utf-8',
    env: getGitEnv(),
  });
  return stdout.trim();
}

/**
 * Get remote tags for a repository
 */
export async function getRemoteTags(repoUrl: string): Promise<GitTag[]> {
  try {
    const output = await git(['ls-remote', '--tags', '--refs', repoUrl]);

    if (!output) {
      return [];
    }

    const tags: GitTag[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const [commit, ref] = line.split('\t');
      if (commit && ref) {
        // Extract tag name from refs/tags/v1.0.0
        const tagName = ref.replace('refs/tags/', '');
        tags.push({ name: tagName, commit });
      }
    }

    return tags;
  } catch {
    return [];
  }
}

/**
 * Get latest tag from repository
 */
export async function getLatestTag(repoUrl: string): Promise<GitTag | null> {
  const tags = await getRemoteTags(repoUrl);

  if (tags.length === 0) {
    return null;
  }

  // Sort by semver (simple version sort)
  const sortedTags = tags.sort((a, b) => {
    const aVer = a.name.replace(/^v/, '');
    const bVer = b.name.replace(/^v/, '');
    return compareVersions(bVer, aVer);
  });

  return sortedTags[0];
}

/**
 * Clone a repository with shallow clone
 *
 * @throws {GitCloneError} When clone fails, with helpful tips for authentication issues
 */
export async function clone(
  repoUrl: string,
  destPath: string,
  options?: { branch?: string; depth?: number },
): Promise<void> {
  const args = ['clone'];

  if (options?.depth) {
    args.push('--depth', options.depth.toString());
  }

  if (options?.branch) {
    args.push('--branch', options.branch);
  }

  args.push(repoUrl, destPath);

  try {
    await git(args);
  } catch (error) {
    throw new GitCloneError(repoUrl, error as Error);
  }
}

/**
 * Checkout a specific ref (tag, branch, commit)
 */
export async function checkout(ref: string, cwd: string): Promise<void> {
  await git(['checkout', ref], cwd);
}

/**
 * Fetch tags from remote
 */
export async function fetchTags(cwd: string): Promise<void> {
  await git(['fetch', '--tags'], cwd);
}

/**
 * Get current commit hash
 */
export async function getCurrentCommit(cwd: string): Promise<string> {
  return git(['rev-parse', 'HEAD'], cwd);
}

/**
 * Get default branch name
 */
export async function getDefaultBranch(repoUrl: string): Promise<string> {
  try {
    const output = await git(['ls-remote', '--symref', repoUrl, 'HEAD']);
    const match = output.match(/ref: refs\/heads\/(\S+)/);
    return match ? match[1] : 'main';
  } catch {
    return 'main';
  }
}

/**
 * Check if a ref exists in remote
 */
export async function refExists(repoUrl: string, ref: string): Promise<boolean> {
  try {
    const output = await git(['ls-remote', repoUrl, ref]);
    return output.length > 0;
  } catch {
    return false;
  }
}

/**
 * Simple version comparison (for sorting)
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map((p) => parseInt(p, 10) || 0);
  const bParts = b.split('.').map((p) => parseInt(p, 10) || 0);

  const maxLength = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLength; i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;

    if (aPart > bPart) return 1;
    if (aPart < bPart) return -1;
  }

  return 0;
}

/**
 * Build repository URL from registry and path
 */
export function buildRepoUrl(registry: string, ownerRepo: string): string {
  // Handle known registries
  const registryUrls: Record<string, string> = {
    github: 'https://github.com',
    gitlab: 'https://gitlab.com',
  };

  const baseUrl = registryUrls[registry] || `https://${registry}`;
  return `${baseUrl}/${ownerRepo}`;
}

// ============================================================================
// Git URL Parsing Utilities
// ============================================================================

/**
 * Parsed Git URL information
 */
export interface ParsedGitUrl {
  /** Host name (e.g., github.com, gitlab.company.com) */
  host: string;
  /** Repository owner/organization */
  owner: string;
  /** Repository name (without .git suffix) */
  repo: string;
  /** Original URL */
  url: string;
  /** URL type: ssh, https, git, or file (for local testing) */
  type: 'ssh' | 'https' | 'git' | 'file';
}

/**
 * Check if a source string is a complete Git URL (SSH, HTTPS, git://, or file://)
 *
 * Supported formats:
 * - SSH: git@github.com:user/repo.git
 * - HTTPS: https://github.com/user/repo.git
 * - Git protocol: git://github.com/user/repo.git
 * - File protocol: file:///path/to/repo (for local testing)
 * - URLs ending with .git
 */
export function isGitUrl(source: string): boolean {
  return (
    source.startsWith('git@') ||
    source.startsWith('git://') ||
    source.startsWith('http://') ||
    source.startsWith('https://') ||
    source.startsWith('file://') ||
    source.endsWith('.git')
  );
}

/**
 * Parse a Git URL and extract host, owner, and repo information
 *
 * Supports:
 * - SSH: git@github.com:user/repo.git
 * - HTTPS: https://github.com/user/repo.git
 * - Git protocol: git://github.com/user/repo.git
 *
 * Note: GitHub/GitLab web URLs (with /tree/, /blob/, etc.) are handled
 * at a higher level in GitResolver.parseGitUrlRef() before calling this function.
 *
 * @param url The Git URL to parse
 * @returns Parsed URL information or null if parsing fails
 */
export function parseGitUrl(url: string): ParsedGitUrl | null {
  // Remove trailing .git if present
  const cleanUrl = url.replace(/\.git$/, '');

  // SSH format: git@github.com:user/repo
  const sshMatch = cleanUrl.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    const [, host, path] = sshMatch;
    const parts = path.split('/');
    if (parts.length >= 2) {
      // Handle nested paths like org/sub/repo
      const owner = parts.slice(0, -1).join('/');
      const repo = parts[parts.length - 1];
      return {
        host,
        owner,
        repo,
        url,
        type: 'ssh',
      };
    }
  }

  // HTTPS/Git protocol format: https://github.com/user/repo or git://github.com/user/repo
  const httpMatch = cleanUrl.match(/^(https?|git):\/\/([^/]+)\/(.+)$/);
  if (httpMatch) {
    const [, protocol, host, path] = httpMatch;
    const parts = path.split('/');
    if (parts.length >= 2) {
      const owner = parts.slice(0, -1).join('/');
      const repo = parts[parts.length - 1];
      return {
        host,
        owner,
        repo,
        url,
        type: protocol === 'git' ? 'git' : 'https',
      };
    }
  }

  // File protocol format: file:///path/to/repo
  // Used for local testing and development
  const fileMatch = cleanUrl.match(/^file:\/\/(.+)$/);
  if (fileMatch) {
    const [, filePath] = fileMatch;
    const parts = filePath.split('/').filter(Boolean);
    if (parts.length >= 1) {
      // Use 'local' as host, path components as owner/repo
      const repo = parts[parts.length - 1];
      const owner = parts.length > 1 ? parts[parts.length - 2] : 'local';
      return {
        host: 'local',
        owner,
        repo,
        url,
        type: 'file',
      };
    }
  }

  return null;
}

/**
 * Get the repository name from a Git URL
 */
export function getRepoNameFromUrl(url: string): string | null {
  const parsed = parseGitUrl(url);
  return parsed ? parsed.repo : null;
}
