import { describe, expect, it } from 'vitest';
import { buildRepoUrl, GitCloneError, getRepoNameFromUrl, isGitUrl, parseGitUrl } from './git.js';

// Note: Most git functions require actual git operations
// Here we test the pure functions and mock-able parts

describe('git utilities', () => {
  describe('buildRepoUrl', () => {
    it('should build github URL', () => {
      expect(buildRepoUrl('github', 'user/repo')).toBe('https://github.com/user/repo');
    });

    it('should build gitlab URL', () => {
      expect(buildRepoUrl('gitlab', 'group/repo')).toBe('https://gitlab.com/group/repo');
    });

    it('should build custom registry URL', () => {
      expect(buildRepoUrl('gitlab.company.com', 'team/repo')).toBe(
        'https://gitlab.company.com/team/repo',
      );
    });

    it('should handle nested paths', () => {
      expect(buildRepoUrl('github', 'org/monorepo/packages/skill')).toBe(
        'https://github.com/org/monorepo/packages/skill',
      );
    });
  });

  describe('isGitUrl', () => {
    it('should detect SSH URLs', () => {
      expect(isGitUrl('git@github.com:user/repo.git')).toBe(true);
      expect(isGitUrl('git@gitlab.company.com:team/skill.git')).toBe(true);
    });

    it('should detect HTTPS URLs', () => {
      expect(isGitUrl('https://github.com/user/repo.git')).toBe(true);
      expect(isGitUrl('https://gitlab.company.com/team/skill.git')).toBe(true);
      expect(isGitUrl('http://github.com/user/repo.git')).toBe(true);
    });

    it('should detect git:// protocol URLs', () => {
      expect(isGitUrl('git://github.com/user/repo.git')).toBe(true);
    });

    it('should detect URLs ending with .git', () => {
      expect(isGitUrl('user/repo.git')).toBe(true);
    });

    it('should not match simple owner/repo format', () => {
      expect(isGitUrl('user/repo')).toBe(false);
      expect(isGitUrl('github:user/repo')).toBe(false);
    });
  });

  describe('parseGitUrl', () => {
    describe('SSH URLs', () => {
      it('should parse basic SSH URL', () => {
        const result = parseGitUrl('git@github.com:user/repo.git');
        expect(result).toEqual({
          host: 'github.com',
          owner: 'user',
          repo: 'repo',
          url: 'git@github.com:user/repo.git',
          type: 'ssh',
        });
      });

      it('should parse SSH URL without .git suffix', () => {
        const result = parseGitUrl('git@github.com:user/repo');
        expect(result).toEqual({
          host: 'github.com',
          owner: 'user',
          repo: 'repo',
          url: 'git@github.com:user/repo',
          type: 'ssh',
        });
      });

      it('should parse SSH URL with nested owner path', () => {
        const result = parseGitUrl('git@gitlab.company.com:team/subteam/repo.git');
        expect(result).toEqual({
          host: 'gitlab.company.com',
          owner: 'team/subteam',
          repo: 'repo',
          url: 'git@gitlab.company.com:team/subteam/repo.git',
          type: 'ssh',
        });
      });
    });

    describe('HTTPS URLs', () => {
      it('should parse basic HTTPS URL', () => {
        const result = parseGitUrl('https://github.com/user/repo.git');
        expect(result).toEqual({
          host: 'github.com',
          owner: 'user',
          repo: 'repo',
          url: 'https://github.com/user/repo.git',
          type: 'https',
        });
      });

      it('should parse HTTPS URL without .git suffix', () => {
        const result = parseGitUrl('https://github.com/user/repo');
        expect(result).toEqual({
          host: 'github.com',
          owner: 'user',
          repo: 'repo',
          url: 'https://github.com/user/repo',
          type: 'https',
        });
      });

      it('should parse HTTP URL', () => {
        const result = parseGitUrl('http://gitlab.local/team/repo.git');
        expect(result).toEqual({
          host: 'gitlab.local',
          owner: 'team',
          repo: 'repo',
          url: 'http://gitlab.local/team/repo.git',
          type: 'https',
        });
      });

      it('should parse HTTPS URL with nested owner path', () => {
        const result = parseGitUrl('https://gitlab.company.com/team/subteam/repo.git');
        expect(result).toEqual({
          host: 'gitlab.company.com',
          owner: 'team/subteam',
          repo: 'repo',
          url: 'https://gitlab.company.com/team/subteam/repo.git',
          type: 'https',
        });
      });
    });

    describe('git:// protocol', () => {
      it('should parse git:// URL', () => {
        const result = parseGitUrl('git://github.com/user/repo.git');
        expect(result).toEqual({
          host: 'github.com',
          owner: 'user',
          repo: 'repo',
          url: 'git://github.com/user/repo.git',
          type: 'git',
        });
      });
    });

    describe('invalid URLs', () => {
      it('should return null for invalid URLs', () => {
        expect(parseGitUrl('user/repo')).toBe(null);
        expect(parseGitUrl('github:user/repo')).toBe(null);
        expect(parseGitUrl('invalid')).toBe(null);
      });
    });
  });

  describe('getRepoNameFromUrl', () => {
    it('should extract repo name from SSH URL', () => {
      expect(getRepoNameFromUrl('git@github.com:user/my-skill.git')).toBe('my-skill');
    });

    it('should extract repo name from HTTPS URL', () => {
      expect(getRepoNameFromUrl('https://github.com/user/my-skill.git')).toBe('my-skill');
    });

    it('should return null for invalid URL', () => {
      expect(getRepoNameFromUrl('invalid')).toBe(null);
    });
  });

  describe('GitCloneError', () => {
    it('should create error with helpful message', () => {
      const originalError = new Error('Command failed');
      const error = new GitCloneError('git@github.com:user/repo.git', originalError);

      expect(error.name).toBe('GitCloneError');
      expect(error.repoUrl).toBe('git@github.com:user/repo.git');
      expect(error.originalError).toBe(originalError);
      expect(error.message).toContain('Failed to clone repository');
    });

    it('should detect authentication errors and provide tips', () => {
      const authError = new Error('Permission denied (publickey)');
      const error = new GitCloneError('git@github.com:user/repo.git', authError);

      expect(error.isAuthError).toBe(true);
      expect(error.message).toContain('SSH');
    });

    it('should not show auth tips for non-auth errors', () => {
      const otherError = new Error('Network timeout');
      const error = new GitCloneError('git@github.com:user/repo.git', otherError);

      expect(error.isAuthError).toBe(false);
    });

    describe('smart tips based on URL type', () => {
      it('should show only SSH tips for SSH URLs', () => {
        const authError = new Error('Permission denied (publickey)');
        const error = new GitCloneError('git@github.com:user/repo.git', authError);

        expect(error.isAuthError).toBe(true);
        expect(error.message).toContain('SSH');
        expect(error.message).toContain('~/.ssh/');
        expect(error.message).not.toContain('credential.helper');
        expect(error.message).not.toContain('personal access token');
      });

      it('should show only HTTPS tips for HTTPS URLs', () => {
        const authError = new Error('Authentication failed for https://github.com');
        const error = new GitCloneError('https://github.com/user/repo.git', authError);

        expect(error.isAuthError).toBe(true);
        expect(error.message).toContain('credential.helper');
        expect(error.message).toContain('personal access token');
        expect(error.message).not.toContain('~/.ssh/');
      });

      it('should show only HTTPS tips for HTTP URLs', () => {
        const authError = new Error('401 Unauthorized');
        const error = new GitCloneError('http://gitlab.local/user/repo.git', authError);

        expect(error.isAuthError).toBe(true);
        expect(error.message).toContain('credential.helper');
        expect(error.message).not.toContain('~/.ssh/');
      });
    });

    describe('isAuthenticationError', () => {
      it('should detect permission denied', () => {
        expect(GitCloneError.isAuthenticationError('Permission denied (publickey)')).toBe(true);
      });

      it('should detect could not read from remote', () => {
        expect(
          GitCloneError.isAuthenticationError('fatal: Could not read from remote repository'),
        ).toBe(true);
      });

      it('should detect authentication failed', () => {
        expect(
          GitCloneError.isAuthenticationError('Authentication failed for https://github.com'),
        ).toBe(true);
      });

      it('should detect repository not found', () => {
        expect(
          GitCloneError.isAuthenticationError(
            'fatal: repository https://github.com/user/repo not found',
          ),
        ).toBe(true);
      });

      it('should detect host key verification failed', () => {
        expect(GitCloneError.isAuthenticationError('Host key verification failed')).toBe(true);
      });

      it('should detect 401/403 errors', () => {
        expect(GitCloneError.isAuthenticationError('error: 401 Unauthorized')).toBe(true);
        expect(GitCloneError.isAuthenticationError('error: 403 Forbidden')).toBe(true);
      });

      it('should not match unrelated errors', () => {
        expect(GitCloneError.isAuthenticationError('Network timeout')).toBe(false);
        expect(GitCloneError.isAuthenticationError('Disk full')).toBe(false);
      });
    });
  });
});

// Integration tests for git operations would go here
// These require actual git repositories and network access
describe('git operations (integration)', () => {
  it.skip('should get remote tags', async () => {
    // Skip in CI, run locally with actual repos
  });

  it.skip('should get latest tag', async () => {
    // Skip in CI, run locally with actual repos
  });

  it.skip('should clone repository', async () => {
    // Skip in CI, run locally with actual repos
  });
});
