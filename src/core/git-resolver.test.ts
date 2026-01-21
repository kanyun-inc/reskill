import { describe, it, expect } from 'vitest';
import { GitResolver } from './git-resolver.js';

describe('GitResolver', () => {
  const resolver = new GitResolver('github');

  describe('parseRef', () => {
    it('should parse simple owner/repo', () => {
      const result = resolver.parseRef('user/skill');
      expect(result).toEqual({
        registry: 'github',
        owner: 'user',
        repo: 'skill',
        subPath: undefined,
        version: undefined,
        raw: 'user/skill',
      });
    });

    it('should parse owner/repo with version', () => {
      const result = resolver.parseRef('user/skill@v1.0.0');
      expect(result).toEqual({
        registry: 'github',
        owner: 'user',
        repo: 'skill',
        subPath: undefined,
        version: 'v1.0.0',
        raw: 'user/skill@v1.0.0',
      });
    });

    it('should parse with registry prefix', () => {
      const result = resolver.parseRef('gitlab:group/skill@latest');
      expect(result).toEqual({
        registry: 'gitlab',
        owner: 'group',
        repo: 'skill',
        subPath: undefined,
        version: 'latest',
        raw: 'gitlab:group/skill@latest',
      });
    });

    it('should parse with custom registry', () => {
      const result = resolver.parseRef('gitlab.company.com:team/skill@v2.0.0');
      expect(result).toEqual({
        registry: 'gitlab.company.com',
        owner: 'team',
        repo: 'skill',
        subPath: undefined,
        version: 'v2.0.0',
        raw: 'gitlab.company.com:team/skill@v2.0.0',
      });
    });

    it('should parse with subPath (monorepo)', () => {
      const result = resolver.parseRef('github:org/monorepo/skills/pdf@v1.0.0');
      expect(result).toEqual({
        registry: 'github',
        owner: 'org',
        repo: 'monorepo',
        subPath: 'skills/pdf',
        version: 'v1.0.0',
        raw: 'github:org/monorepo/skills/pdf@v1.0.0',
      });
    });

    it('should throw for invalid ref', () => {
      expect(() => resolver.parseRef('invalid')).toThrow('Invalid skill reference');
    });
  });

  describe('parseVersion', () => {
    it('should parse exact version', () => {
      expect(resolver.parseVersion('v1.0.0')).toEqual({
        type: 'exact',
        value: 'v1.0.0',
        raw: 'v1.0.0',
      });
    });

    it('should parse latest', () => {
      expect(resolver.parseVersion('latest')).toEqual({
        type: 'latest',
        value: 'latest',
        raw: 'latest',
      });
    });

    it('should parse semver range with ^', () => {
      expect(resolver.parseVersion('^2.0.0')).toEqual({
        type: 'range',
        value: '^2.0.0',
        raw: '^2.0.0',
      });
    });

    it('should parse semver range with ~', () => {
      expect(resolver.parseVersion('~1.2.3')).toEqual({
        type: 'range',
        value: '~1.2.3',
        raw: '~1.2.3',
      });
    });

    it('should parse branch', () => {
      expect(resolver.parseVersion('branch:develop')).toEqual({
        type: 'branch',
        value: 'develop',
        raw: 'branch:develop',
      });
    });

    it('should parse commit', () => {
      expect(resolver.parseVersion('commit:abc1234')).toEqual({
        type: 'commit',
        value: 'abc1234',
        raw: 'commit:abc1234',
      });
    });

    it('should default to branch:main for undefined', () => {
      expect(resolver.parseVersion(undefined)).toEqual({
        type: 'branch',
        value: 'main',
        raw: '',
      });
    });
  });

  describe('buildRepoUrl', () => {
    it('should build github URL', () => {
      const parsed = resolver.parseRef('user/repo');
      expect(resolver.buildRepoUrl(parsed)).toBe('https://github.com/user/repo');
    });

    it('should build gitlab URL', () => {
      const parsed = resolver.parseRef('gitlab:group/repo');
      expect(resolver.buildRepoUrl(parsed)).toBe('https://gitlab.com/group/repo');
    });

    it('should build custom registry URL', () => {
      const parsed = resolver.parseRef('gitlab.company.com:team/repo');
      expect(resolver.buildRepoUrl(parsed)).toBe('https://gitlab.company.com/team/repo');
    });

    it('should return gitUrl directly when present', () => {
      const parsed = resolver.parseRef('git@github.com:user/repo.git');
      expect(resolver.buildRepoUrl(parsed)).toBe('git@github.com:user/repo.git');
    });
  });

  describe('parseRef with Git URLs', () => {
    describe('SSH URLs', () => {
      it('should parse basic SSH URL', () => {
        const result = resolver.parseRef('git@github.com:user/skill.git');
        expect(result).toEqual({
          registry: 'github.com',
          owner: 'user',
          repo: 'skill',
          subPath: undefined,
          version: undefined,
          raw: 'git@github.com:user/skill.git',
          gitUrl: 'git@github.com:user/skill.git',
        });
      });

      it('should parse SSH URL with version', () => {
        const result = resolver.parseRef('git@github.com:user/skill.git@v1.0.0');
        expect(result).toEqual({
          registry: 'github.com',
          owner: 'user',
          repo: 'skill',
          subPath: undefined,
          version: 'v1.0.0',
          raw: 'git@github.com:user/skill.git@v1.0.0',
          gitUrl: 'git@github.com:user/skill.git',
        });
      });

      it('should parse SSH URL with subpath', () => {
        const result = resolver.parseRef('git@github.com:org/skills.git/pdf');
        expect(result).toEqual({
          registry: 'github.com',
          owner: 'org',
          repo: 'skills',
          subPath: 'pdf',
          version: undefined,
          raw: 'git@github.com:org/skills.git/pdf',
          gitUrl: 'git@github.com:org/skills.git',
        });
      });

      it('should parse SSH URL with subpath and version', () => {
        const result = resolver.parseRef('git@github.com:org/skills.git/pdf@v1.0.0');
        expect(result).toEqual({
          registry: 'github.com',
          owner: 'org',
          repo: 'skills',
          subPath: 'pdf',
          version: 'v1.0.0',
          raw: 'git@github.com:org/skills.git/pdf@v1.0.0',
          gitUrl: 'git@github.com:org/skills.git',
        });
      });

      it('should parse SSH URL with nested subpath', () => {
        const result = resolver.parseRef('git@github.com:org/skills.git/packages/pdf@latest');
        expect(result).toEqual({
          registry: 'github.com',
          owner: 'org',
          repo: 'skills',
          subPath: 'packages/pdf',
          version: 'latest',
          raw: 'git@github.com:org/skills.git/packages/pdf@latest',
          gitUrl: 'git@github.com:org/skills.git',
        });
      });

      it('should parse private GitLab SSH URL', () => {
        const result = resolver.parseRef('git@gitlab.company.com:team/private-skill.git@v2.0.0');
        expect(result).toEqual({
          registry: 'gitlab.company.com',
          owner: 'team',
          repo: 'private-skill',
          subPath: undefined,
          version: 'v2.0.0',
          raw: 'git@gitlab.company.com:team/private-skill.git@v2.0.0',
          gitUrl: 'git@gitlab.company.com:team/private-skill.git',
        });
      });
    });

    describe('HTTPS URLs', () => {
      it('should parse basic HTTPS URL', () => {
        const result = resolver.parseRef('https://github.com/user/skill.git');
        expect(result).toEqual({
          registry: 'github.com',
          owner: 'user',
          repo: 'skill',
          subPath: undefined,
          version: undefined,
          raw: 'https://github.com/user/skill.git',
          gitUrl: 'https://github.com/user/skill.git',
        });
      });

      it('should parse HTTPS URL with version', () => {
        const result = resolver.parseRef('https://github.com/user/skill.git@v1.0.0');
        expect(result).toEqual({
          registry: 'github.com',
          owner: 'user',
          repo: 'skill',
          subPath: undefined,
          version: 'v1.0.0',
          raw: 'https://github.com/user/skill.git@v1.0.0',
          gitUrl: 'https://github.com/user/skill.git',
        });
      });

      it('should parse HTTPS URL with subpath and version', () => {
        const result = resolver.parseRef('https://github.com/org/skills.git/pdf@v1.0.0');
        expect(result).toEqual({
          registry: 'github.com',
          owner: 'org',
          repo: 'skills',
          subPath: 'pdf',
          version: 'v1.0.0',
          raw: 'https://github.com/org/skills.git/pdf@v1.0.0',
          gitUrl: 'https://github.com/org/skills.git',
        });
      });

      it('should parse private GitLab HTTPS URL', () => {
        const result = resolver.parseRef('https://gitlab.company.com/team/skill.git@v2.0.0');
        expect(result).toEqual({
          registry: 'gitlab.company.com',
          owner: 'team',
          repo: 'skill',
          subPath: undefined,
          version: 'v2.0.0',
          raw: 'https://gitlab.company.com/team/skill.git@v2.0.0',
          gitUrl: 'https://gitlab.company.com/team/skill.git',
        });
      });
    });

    describe('Error cases', () => {
      it('should throw for invalid Git URL format', () => {
        expect(() => resolver.parseRef('git@invalid')).toThrow('Invalid Git URL');
      });
    });
  });

  describe('constructor', () => {
    it('should use github as default registry', () => {
      const resolver = new GitResolver();
      const parsed = resolver.parseRef('user/repo');
      expect(parsed.registry).toBe('github');
    });

    it('should use custom default registry', () => {
      const resolver = new GitResolver('gitlab');
      const parsed = resolver.parseRef('user/repo');
      expect(parsed.registry).toBe('gitlab');
    });
  });

  describe('parseRef edge cases', () => {
    it('should handle repo name with dots', () => {
      const result = resolver.parseRef('user/my.skill.name@v1.0.0');
      expect(result.repo).toBe('my.skill.name');
    });

    it('should handle org with hyphens', () => {
      const result = resolver.parseRef('my-org/my-skill@v1.0.0');
      expect(result.owner).toBe('my-org');
      expect(result.repo).toBe('my-skill');
    });

    it('should handle numeric version', () => {
      const result = resolver.parseRef('user/skill@1.0.0');
      expect(result.version).toBe('1.0.0');
    });
  });

  describe('parseVersion edge cases', () => {
    it('should parse version with prerelease', () => {
      const result = resolver.parseVersion('v1.0.0-beta.1');
      expect(result.type).toBe('exact');
      expect(result.value).toBe('v1.0.0-beta.1');
    });

    it('should parse version with build metadata', () => {
      const result = resolver.parseVersion('v1.0.0+build123');
      expect(result.type).toBe('exact');
      expect(result.value).toBe('v1.0.0+build123');
    });

    it('should treat empty string as default branch', () => {
      const result = resolver.parseVersion('');
      expect(result.type).toBe('branch');
      expect(result.value).toBe('main');
    });
  });
});

// Integration tests (require network)
describe('GitResolver integration', () => {
  it.skip('should resolve latest version from real repo', async () => {
    const resolver = new GitResolver();
    const result = await resolver.resolve('OthmanAdi/planning-with-files@latest');
    expect(result.ref).toBeDefined();
  });

  it.skip('should resolve from SSH URL', async () => {
    const resolver = new GitResolver();
    const result = await resolver.resolve('git@github.com:OthmanAdi/planning-with-files.git@latest');
    expect(result.ref).toBeDefined();
    expect(result.parsed.gitUrl).toBe('git@github.com:OthmanAdi/planning-with-files.git');
  });
});
