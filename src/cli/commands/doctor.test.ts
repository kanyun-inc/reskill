import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type CheckResult,
  type CheckStatus,
  checkCacheDir,
  checkGitAuth,
  checkGitVersion,
  checkInstalledSkills,
  checkInstallDir,
  checkMonorepoVersions,
  checkNetwork,
  checkNodeVersion,
  checkRegistryConflicts,
  checkReskillVersion,
  checkSkillRefs,
  checkSkillsJson,
  checkSkillsLock,
  checkTargetAgents,
  countCachedSkills,
  execCommand,
  formatBytes,
  getDirSize,
  getStatusIcon,
  printResult,
  runDoctorChecks,
} from './doctor.js';

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    newline: vi.fn(),
  },
}));

// Mock chalk to return plain strings for easier testing
vi.mock('chalk', () => ({
  default: {
    green: (s: string) => `[green]${s}[/green]`,
    yellow: (s: string) => `[yellow]${s}[/yellow]`,
    red: (s: string) => `[red]${s}[/red]`,
    dim: (s: string) => `[dim]${s}[/dim]`,
    bold: (s: string) => `[bold]${s}[/bold]`,
    blue: (s: string) => `[blue]${s}[/blue]`,
    cyan: (s: string) => `[cyan]${s}[/cyan]`,
    gray: (s: string) => `[gray]${s}[/gray]`,
  },
}));

describe('doctor command utilities', () => {
  describe('getStatusIcon', () => {
    it('should return green checkmark for ok status', () => {
      const icon = getStatusIcon('ok');
      expect(icon).toContain('✓');
      expect(icon).toContain('green');
    });

    it('should return yellow warning for warn status', () => {
      const icon = getStatusIcon('warn');
      expect(icon).toContain('⚠');
      expect(icon).toContain('yellow');
    });

    it('should return red X for error status', () => {
      const icon = getStatusIcon('error');
      expect(icon).toContain('✗');
      expect(icon).toContain('red');
    });
  });

  describe('execCommand', () => {
    it('should return output for valid command', () => {
      const result = execCommand('echo hello');
      expect(result).toBe('hello');
    });

    it('should return null for invalid command', () => {
      const result = execCommand('nonexistent-command-12345');
      expect(result).toBeNull();
    });

    it('should trim whitespace from output', () => {
      const result = execCommand('echo "  hello  "');
      expect(result).toBe('hello');
    });
  });

  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(2048)).toBe('2 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('getDirSize', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = join(tmpdir(), `doctor-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should return 0 for non-existent directory', () => {
      expect(getDirSize('/nonexistent/path')).toBe(0);
    });

    it('should return 0 for empty directory', () => {
      expect(getDirSize(testDir)).toBe(0);
    });

    it('should calculate size of files', () => {
      writeFileSync(join(testDir, 'file1.txt'), 'hello'); // 5 bytes
      writeFileSync(join(testDir, 'file2.txt'), 'world!'); // 6 bytes
      expect(getDirSize(testDir)).toBe(11);
    });

    it('should calculate size of nested directories', () => {
      const subDir = join(testDir, 'sub');
      mkdirSync(subDir);
      writeFileSync(join(testDir, 'file1.txt'), 'hello'); // 5 bytes
      writeFileSync(join(subDir, 'file2.txt'), 'world!'); // 6 bytes
      expect(getDirSize(testDir)).toBe(11);
    });
  });

  describe('countCachedSkills', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = join(tmpdir(), `doctor-cache-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should return 0 for non-existent directory', () => {
      expect(countCachedSkills('/nonexistent/path')).toBe(0);
    });

    it('should return 0 for empty directory', () => {
      expect(countCachedSkills(testDir)).toBe(0);
    });

    it('should count cached skills correctly', () => {
      // Create cache structure: registry/owner/repo/version
      const skillPath1 = join(testDir, 'github.com', 'user1', 'skill1', 'v1.0.0');
      const skillPath2 = join(testDir, 'github.com', 'user1', 'skill1', 'v2.0.0');
      const skillPath3 = join(testDir, 'gitlab.com', 'user2', 'skill2', 'v1.0.0');

      mkdirSync(skillPath1, { recursive: true });
      mkdirSync(skillPath2, { recursive: true });
      mkdirSync(skillPath3, { recursive: true });

      expect(countCachedSkills(testDir)).toBe(3);
    });
  });
});

describe('doctor checks', () => {
  describe('checkNodeVersion', () => {
    it('should return ok for current Node.js version', () => {
      const result = checkNodeVersion();
      // Current Node.js should be >= 18
      expect(result.status).toBe('ok');
      expect(result.name).toBe('Node.js version');
      expect(result.message).toContain(process.version);
    });
  });

  describe('checkGitVersion', () => {
    it('should return ok when git is installed', () => {
      const result = checkGitVersion();
      // Git should be installed in test environment
      expect(result.name).toBe('Git');
      // Could be ok or error depending on environment
      if (result.status === 'ok') {
        expect(result.message).toMatch(/\d+\.\d+/);
      }
    });
  });

  describe('checkGitAuth', () => {
    it('should return a valid check result', () => {
      const result = checkGitAuth();
      expect(result.name).toBe('Git authentication');
      expect(['ok', 'warn', 'error']).toContain(result.status);
    });
  });

  describe('checkCacheDir', () => {
    it('should return ok status', () => {
      const result = checkCacheDir();
      expect(result.name).toBe('Cache directory');
      expect(result.status).toBe('ok');
    });
  });

  describe('checkSkillsJson', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = join(tmpdir(), `doctor-skills-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should return warn when skills.json does not exist', () => {
      const result = checkSkillsJson(testDir);
      expect(result.status).toBe('warn');
      expect(result.message).toBe('not found');
      expect(result.hint).toContain('reskill init');
    });

    it('should return ok when skills.json exists with skills', () => {
      writeFileSync(
        join(testDir, 'skills.json'),
        JSON.stringify({
          skills: {
            'test-skill': 'github:user/repo@v1.0.0',
          },
        }),
      );
      const result = checkSkillsJson(testDir);
      expect(result.status).toBe('ok');
      expect(result.message).toContain('1 skill');
    });

    it('should return ok with 0 skills when skills.json is empty', () => {
      writeFileSync(
        join(testDir, 'skills.json'),
        JSON.stringify({
          skills: {},
        }),
      );
      const result = checkSkillsJson(testDir);
      expect(result.status).toBe('ok');
      expect(result.message).toContain('0 skills');
    });

    it('should return error for invalid skills.json', () => {
      writeFileSync(join(testDir, 'skills.json'), 'invalid json{');
      const result = checkSkillsJson(testDir);
      expect(result.status).toBe('error');
      expect(result.message).toContain('invalid format');
    });
  });

  describe('checkSkillsLock', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = join(tmpdir(), `doctor-lock-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should return ok when no skills.json exists', () => {
      const result = checkSkillsLock(testDir);
      expect(result.status).toBe('ok');
      expect(result.message).toContain('n/a');
    });

    it('should return ok when skills.json has no skills', () => {
      writeFileSync(
        join(testDir, 'skills.json'),
        JSON.stringify({
          skills: {},
        }),
      );
      const result = checkSkillsLock(testDir);
      expect(result.status).toBe('ok');
      expect(result.message).toContain('n/a');
    });

    it('should return warn when skills.lock does not exist but skills.json has skills', () => {
      writeFileSync(
        join(testDir, 'skills.json'),
        JSON.stringify({
          skills: {
            'test-skill': 'github:user/repo@v1.0.0',
          },
        }),
      );
      const result = checkSkillsLock(testDir);
      expect(result.status).toBe('warn');
      expect(result.message).toBe('not found');
      expect(result.hint).toContain('reskill install');
    });

    it('should return ok when skills.lock is in sync', () => {
      writeFileSync(
        join(testDir, 'skills.json'),
        JSON.stringify({
          skills: {
            'test-skill': 'github:user/repo@v1.0.0',
          },
        }),
      );
      writeFileSync(
        join(testDir, 'skills.lock'),
        JSON.stringify({
          lockfileVersion: 1,
          skills: {
            'test-skill': {
              source: 'github:user/repo',
              version: 'v1.0.0',
              ref: 'v1.0.0',
              resolved: 'https://github.com/user/repo',
              commit: 'abc123',
              installedAt: new Date().toISOString(),
            },
          },
        }),
      );
      const result = checkSkillsLock(testDir);
      expect(result.status).toBe('ok');
      expect(result.message).toContain('in sync');
    });

    it('should return warn when skills.lock is missing skills', () => {
      writeFileSync(
        join(testDir, 'skills.json'),
        JSON.stringify({
          skills: {
            'test-skill': 'github:user/repo@v1.0.0',
            'another-skill': 'github:user/another@v1.0.0',
          },
        }),
      );
      writeFileSync(
        join(testDir, 'skills.lock'),
        JSON.stringify({
          lockfileVersion: 1,
          skills: {
            'test-skill': {
              source: 'github:user/repo',
              version: 'v1.0.0',
              ref: 'v1.0.0',
              resolved: 'https://github.com/user/repo',
              commit: 'abc123',
              installedAt: new Date().toISOString(),
            },
          },
        }),
      );
      const result = checkSkillsLock(testDir);
      expect(result.status).toBe('warn');
      expect(result.message).toContain('out of sync');
      expect(result.message).toContain('missing');
    });

    it('should return warn when skills.lock has extra skills', () => {
      writeFileSync(
        join(testDir, 'skills.json'),
        JSON.stringify({
          skills: {
            'test-skill': 'github:user/repo@v1.0.0',
          },
        }),
      );
      writeFileSync(
        join(testDir, 'skills.lock'),
        JSON.stringify({
          lockfileVersion: 1,
          skills: {
            'test-skill': {
              source: 'github:user/repo',
              version: 'v1.0.0',
              ref: 'v1.0.0',
              resolved: 'https://github.com/user/repo',
              commit: 'abc123',
              installedAt: new Date().toISOString(),
            },
            'extra-skill': {
              source: 'github:user/extra',
              version: 'v1.0.0',
              ref: 'v1.0.0',
              resolved: 'https://github.com/user/extra',
              commit: 'def456',
              installedAt: new Date().toISOString(),
            },
          },
        }),
      );
      const result = checkSkillsLock(testDir);
      expect(result.status).toBe('warn');
      expect(result.message).toContain('out of sync');
      expect(result.message).toContain('extra');
    });
  });

  describe('checkInstalledSkills', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = join(tmpdir(), `doctor-installed-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should return ok when no skills are installed', () => {
      const results = checkInstalledSkills(testDir);
      expect(results.length).toBe(1);
      expect(results[0].status).toBe('ok');
      expect(results[0].message).toBe('none');
    });

    it('should return ok when skills are properly installed', () => {
      const skillsDir = join(testDir, '.skills', 'test-skill');
      mkdirSync(skillsDir, { recursive: true });
      writeFileSync(join(skillsDir, 'skill.json'), JSON.stringify({ name: 'test-skill' }));
      writeFileSync(join(skillsDir, 'SKILL.md'), '# Test Skill');

      const results = checkInstalledSkills(testDir);
      expect(results.length).toBe(1);
      expect(results[0].status).toBe('ok');
      expect(results[0].message).toContain('1 skill');
    });

    it('should return ok when only SKILL.md exists', () => {
      const skillsDir = join(testDir, '.skills', 'test-skill');
      mkdirSync(skillsDir, { recursive: true });
      writeFileSync(join(skillsDir, 'SKILL.md'), '# Test Skill');

      const results = checkInstalledSkills(testDir);
      expect(results.length).toBe(1);
      expect(results[0].status).toBe('ok');
    });

    it('should return ok when only skill.json exists', () => {
      const skillsDir = join(testDir, '.skills', 'test-skill');
      mkdirSync(skillsDir, { recursive: true });
      writeFileSync(join(skillsDir, 'skill.json'), JSON.stringify({ name: 'test-skill' }));

      const results = checkInstalledSkills(testDir);
      expect(results.length).toBe(1);
      expect(results[0].status).toBe('ok');
    });

    it('should return error for broken skills (missing both skill.json and SKILL.md)', () => {
      const skillsDir = join(testDir, '.skills', 'broken-skill');
      mkdirSync(skillsDir, { recursive: true });
      // No skill.json or SKILL.md

      const results = checkInstalledSkills(testDir);
      expect(results.length).toBe(2); // Summary + detail
      expect(results[0].status).toBe('error');
      expect(results[0].message).toContain('broken');
      expect(results[1].message).toContain('missing both skill.json and SKILL.md');
    });

    it('should return warn for invalid skill.json', () => {
      const skillsDir = join(testDir, '.skills', 'invalid-skill');
      mkdirSync(skillsDir, { recursive: true });
      writeFileSync(join(skillsDir, 'skill.json'), 'not valid json{{{');

      const results = checkInstalledSkills(testDir);
      expect(results.length).toBe(2); // Summary + detail
      expect(results[0].status).toBe('warn');
      expect(results[1].message).toContain('not valid JSON');
    });

    it('should return warn for skill.json missing name field', () => {
      const skillsDir = join(testDir, '.skills', 'no-name-skill');
      mkdirSync(skillsDir, { recursive: true });
      writeFileSync(join(skillsDir, 'skill.json'), JSON.stringify({ version: '1.0.0' }));

      const results = checkInstalledSkills(testDir);
      expect(results.length).toBe(2); // Summary + detail
      expect(results[0].status).toBe('warn');
      expect(results[1].message).toContain('missing "name" field');
    });

    it('should report multiple issues separately', () => {
      // Create two broken skills
      const skill1Dir = join(testDir, '.skills', 'broken-1');
      const skill2Dir = join(testDir, '.skills', 'broken-2');
      mkdirSync(skill1Dir, { recursive: true });
      mkdirSync(skill2Dir, { recursive: true });
      // No files in either

      const results = checkInstalledSkills(testDir);
      expect(results.length).toBe(3); // Summary + 2 details
      expect(results[0].status).toBe('error');
      expect(results[0].message).toContain('2 broken');
      expect(results[1].name).toContain('broken-1');
      expect(results[2].name).toContain('broken-2');
    });

    it('should handle mix of valid and broken skills', () => {
      // Create one valid and one broken skill
      const validDir = join(testDir, '.skills', 'valid-skill');
      const brokenDir = join(testDir, '.skills', 'broken-skill');
      mkdirSync(validDir, { recursive: true });
      mkdirSync(brokenDir, { recursive: true });
      writeFileSync(join(validDir, 'skill.json'), JSON.stringify({ name: 'valid-skill' }));
      // brokenDir has no files

      const results = checkInstalledSkills(testDir);
      expect(results.length).toBe(2); // Summary + 1 detail
      expect(results[0].status).toBe('error');
      expect(results[0].message).toContain('2 installed');
      expect(results[0].message).toContain('1 broken');
    });
  });

  describe('checkNetwork', () => {
    it('should check network connectivity', async () => {
      // This test may fail in CI without network
      const result = await checkNetwork('https://github.com');
      expect(result.name).toContain('Network');
      expect(result.name).toContain('github.com');
      expect(['ok', 'warn', 'error']).toContain(result.status);
    });

    it('should handle unreachable hosts', async () => {
      const result = await checkNetwork('https://nonexistent-host-12345.invalid');
      expect(result.status).toBe('error');
      expect(result.message).toContain('unreachable');
    });
  });

  describe('checkReskillVersion', () => {
    it('should check reskill version', async () => {
      const result = await checkReskillVersion('0.17.0', 'reskill');
      expect(result.name).toBe('reskill version');
      expect(['ok', 'warn']).toContain(result.status);
    });
  });
});

describe('printResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should print ok result without hint', async () => {
    const { logger } = await import('../../utils/logger.js');
    const result: CheckResult = {
      name: 'Test check',
      status: 'ok',
      message: 'all good',
    };
    printResult(result);
    expect(logger.log).toHaveBeenCalled();
  });

  it('should print warn result with hint', async () => {
    const { logger } = await import('../../utils/logger.js');
    const result: CheckResult = {
      name: 'Test check',
      status: 'warn',
      message: 'something to fix',
      hint: 'Run this command',
    };
    printResult(result);
    expect(logger.log).toHaveBeenCalledTimes(2); // Result + hint
  });

  it('should print error result with hint', async () => {
    const { logger } = await import('../../utils/logger.js');
    const result: CheckResult = {
      name: 'Test check',
      status: 'error',
      message: 'failed',
      hint: 'Fix this issue',
    };
    printResult(result);
    expect(logger.log).toHaveBeenCalledTimes(2); // Result + hint
  });
});

describe('checkRegistryConflicts', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `doctor-registry-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should return empty array when no skills.json exists', () => {
    const results = checkRegistryConflicts(testDir);
    expect(results).toEqual([]);
  });

  it('should return empty array when no registries are defined', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({ skills: {} }),
    );
    const results = checkRegistryConflicts(testDir);
    expect(results).toEqual([]);
  });

  it('should warn when github registry is overridden', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {},
        registries: {
          github: 'https://my-mirror.com',
        },
      }),
    );
    const results = checkRegistryConflicts(testDir);
    expect(results.length).toBe(1);
    expect(results[0].status).toBe('warn');
    expect(results[0].message).toContain('github');
    expect(results[0].message).toContain('overrides');
  });

  it('should warn when gitlab registry is overridden', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {},
        registries: {
          gitlab: 'https://my-gitlab.com',
        },
      }),
    );
    const results = checkRegistryConflicts(testDir);
    expect(results.length).toBe(1);
    expect(results[0].status).toBe('warn');
    expect(results[0].message).toContain('gitlab');
  });

  it('should not warn for custom registry names', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {},
        registries: {
          internal: 'https://gitlab.company.com',
          custom: 'https://custom.example.com',
        },
      }),
    );
    const results = checkRegistryConflicts(testDir);
    expect(results).toEqual([]);
  });
});

describe('checkInstallDir', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `doctor-installdir-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should return null when no skills.json exists', () => {
    const result = checkInstallDir(testDir);
    expect(result).toBeNull();
  });

  it('should return null when no installDir is set', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({ skills: {} }),
    );
    const result = checkInstallDir(testDir);
    expect(result).toBeNull();
  });

  it('should return null for safe installDir', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {},
        defaults: { installDir: '.skills' },
      }),
    );
    const result = checkInstallDir(testDir);
    expect(result).toBeNull();
  });

  it('should error for dangerous installDir like src', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {},
        defaults: { installDir: 'src' },
      }),
    );
    const result = checkInstallDir(testDir);
    expect(result).not.toBeNull();
    expect(result?.status).toBe('error');
    expect(result?.message).toContain('src');
  });

  it('should error for dangerous installDir like node_modules', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {},
        defaults: { installDir: 'node_modules' },
      }),
    );
    const result = checkInstallDir(testDir);
    expect(result).not.toBeNull();
    expect(result?.status).toBe('error');
  });

  it('should error for path traversal in installDir', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {},
        defaults: { installDir: '../outside' },
      }),
    );
    const result = checkInstallDir(testDir);
    expect(result).not.toBeNull();
    expect(result?.status).toBe('error');
    expect(result?.message).toContain('path traversal');
  });
});

describe('checkTargetAgents', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `doctor-agents-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should return empty array when no skills.json exists', () => {
    const results = checkTargetAgents(testDir);
    expect(results).toEqual([]);
  });

  it('should return empty array when no targetAgents is set', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({ skills: {} }),
    );
    const results = checkTargetAgents(testDir);
    expect(results).toEqual([]);
  });

  it('should return empty array for valid agents', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {},
        defaults: { targetAgents: ['cursor', 'claude-code'] },
      }),
    );
    const results = checkTargetAgents(testDir);
    expect(results).toEqual([]);
  });

  it('should warn for invalid agent type', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {},
        defaults: { targetAgents: ['cursor', 'invalid-agent', 'unknown'] },
      }),
    );
    const results = checkTargetAgents(testDir);
    expect(results.length).toBe(2);
    expect(results[0].status).toBe('warn');
    expect(results[0].message).toContain('invalid-agent');
    expect(results[1].message).toContain('unknown');
  });
});

describe('checkSkillRefs', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `doctor-refs-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should return empty array when no skills.json exists', () => {
    const results = checkSkillRefs(testDir);
    expect(results).toEqual([]);
  });

  it('should return empty array for valid skill refs', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {
          'my-skill': 'github:user/repo@v1.0.0',
          'another-skill': 'gitlab:team/skill@latest',
        },
      }),
    );
    const results = checkSkillRefs(testDir);
    expect(results).toEqual([]);
  });

  it('should error for dangerous skill name .git', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {
          '.git': 'github:user/repo@v1.0.0',
        },
      }),
    );
    const results = checkSkillRefs(testDir);
    expect(results.length).toBe(1);
    expect(results[0].status).toBe('error');
    expect(results[0].name).toBe('Dangerous skill name');
  });

  it('should error for skill name with path separator', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {
          'path/to/skill': 'github:user/repo@v1.0.0',
        },
      }),
    );
    const results = checkSkillRefs(testDir);
    expect(results.length).toBe(1);
    expect(results[0].status).toBe('error');
    expect(results[0].name).toBe('Dangerous skill name');
  });

  it('should error for invalid skill ref format', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {
          'my-skill': 'invalid-format-no-slash',
        },
      }),
    );
    const results = checkSkillRefs(testDir);
    expect(results.length).toBe(1);
    expect(results[0].status).toBe('error');
    expect(results[0].name).toBe('Invalid skill ref');
  });

  it('should return empty array for valid HTTP skill refs', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {
          'http-skill': 'https://example.com/skills/my-skill.tar.gz',
          'oss-skill': 'oss://bucket/path/skill.tar.gz',
          's3-skill': 's3://bucket/skills/another.zip',
        },
      }),
    );
    const results = checkSkillRefs(testDir);
    expect(results).toEqual([]);
  });

  it('should return empty array for mixed Git and HTTP skill refs', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {
          'git-skill': 'github:user/repo@v1.0.0',
          'http-skill': 'https://example.com/skills/my-skill.tar.gz',
          'oss-skill': 'oss://bucket/path/skill.tar.gz',
        },
      }),
    );
    const results = checkSkillRefs(testDir);
    expect(results).toEqual([]);
  });

  it('should provide HTTP-specific hint for invalid HTTP refs', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {
          'bad-http-skill': 'https://',
        },
      }),
    );
    const results = checkSkillRefs(testDir);
    expect(results.length).toBe(1);
    expect(results[0].status).toBe('error');
    expect(results[0].hint).toContain('https://');
    expect(results[0].hint).toContain('oss://');
  });
});

describe('checkMonorepoVersions', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `doctor-monorepo-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should return empty array when no skills.json exists', () => {
    const results = checkMonorepoVersions(testDir);
    expect(results).toEqual([]);
  });

  it('should return empty array for non-monorepo skills', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {
          'skill-a': 'github:user/repo-a@v1.0.0',
          'skill-b': 'github:user/repo-b@v2.0.0',
        },
      }),
    );
    const results = checkMonorepoVersions(testDir);
    expect(results).toEqual([]);
  });

  it('should return empty array for monorepo skills with same version', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {
          'skill-a': 'github:org/monorepo/skills/skill-a@v1.0.0',
          'skill-b': 'github:org/monorepo/skills/skill-b@v1.0.0',
        },
      }),
    );
    const results = checkMonorepoVersions(testDir);
    expect(results).toEqual([]);
  });

  it('should warn for monorepo skills with different versions', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {
          'skill-a': 'github:org/monorepo/skills/skill-a@v1.0.0',
          'skill-b': 'github:org/monorepo/skills/skill-b@v2.0.0',
        },
      }),
    );
    const results = checkMonorepoVersions(testDir);
    expect(results.length).toBe(1);
    expect(results[0].status).toBe('warn');
    expect(results[0].name).toBe('Version mismatch');
    expect(results[0].message).toContain('v1.0.0');
    expect(results[0].message).toContain('v2.0.0');
  });

  it('should warn for multiple version mismatches', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {
          'skill-a': 'github:org/monorepo/skills/skill-a@v1.0.0',
          'skill-b': 'github:org/monorepo/skills/skill-b@v2.0.0',
          'skill-c': 'github:org/monorepo/skills/skill-c@v3.0.0',
        },
      }),
    );
    const results = checkMonorepoVersions(testDir);
    expect(results.length).toBe(1);
    expect(results[0].message).toContain('v1.0.0');
    expect(results[0].message).toContain('v2.0.0');
    expect(results[0].message).toContain('v3.0.0');
  });

  it('should skip HTTP sources in monorepo version check', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {
          'http-skill-a': 'https://example.com/skills/a.tar.gz',
          'http-skill-b': 'https://example.com/skills/b.tar.gz',
          'oss-skill': 'oss://bucket/skills/c.tar.gz',
        },
      }),
    );
    const results = checkMonorepoVersions(testDir);
    // HTTP sources should be skipped, no warnings
    expect(results).toEqual([]);
  });

  it('should handle mixed Git and HTTP sources', () => {
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {
          'skill-a': 'github:org/monorepo/skills/skill-a@v1.0.0',
          'skill-b': 'github:org/monorepo/skills/skill-b@v2.0.0',
          'http-skill': 'https://example.com/skills/skill.tar.gz',
        },
      }),
    );
    const results = checkMonorepoVersions(testDir);
    // Should only warn about Git monorepo version mismatch
    expect(results.length).toBe(1);
    expect(results[0].status).toBe('warn');
    expect(results[0].message).toContain('v1.0.0');
    expect(results[0].message).toContain('v2.0.0');
    // Should not mention HTTP skill
    expect(results[0].message).not.toContain('http-skill');
  });
});

describe('runDoctorChecks', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `doctor-run-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should run all checks with skipNetwork and skipConfigChecks', async () => {
    const results = await runDoctorChecks({
      cwd: testDir,
      packageName: 'reskill',
      packageVersion: '0.17.0',
      skipNetwork: true,
      skipConfigChecks: true,
    });

    // Should have 8 basic checks when network and config checks are skipped
    expect(results.length).toBe(8);

    const checkNames = results.map((r) => r.name);
    expect(checkNames).toContain('reskill version');
    expect(checkNames).toContain('Node.js version');
    expect(checkNames).toContain('Git');
    expect(checkNames).toContain('Git authentication');
    expect(checkNames).toContain('Cache directory');
    expect(checkNames).toContain('skills.json');
    expect(checkNames).toContain('skills.lock');
    expect(checkNames).toContain('Installed skills');
  });

  it('should run all checks including network', async () => {
    const results = await runDoctorChecks({
      cwd: testDir,
      packageName: 'reskill',
      packageVersion: '0.17.0',
      skipNetwork: false,
      skipConfigChecks: true,
    });

    // Should have 10 checks with network
    expect(results.length).toBe(10);

    const checkNames = results.map((r) => r.name);
    expect(checkNames.some((n) => n.includes('github.com'))).toBe(true);
    expect(checkNames.some((n) => n.includes('gitlab.com'))).toBe(true);
  });

  it('should include config checks when not skipped', async () => {
    // Create a skills.json with issues
    writeFileSync(
      join(testDir, 'skills.json'),
      JSON.stringify({
        skills: {
          'skill-a': 'github:org/monorepo/a@v1.0.0',
          'skill-b': 'github:org/monorepo/b@v2.0.0',
        },
        registries: {
          github: 'https://mirror.example.com',
        },
        defaults: {
          targetAgents: ['cursor', 'invalid-agent'],
        },
      }),
    );

    const results = await runDoctorChecks({
      cwd: testDir,
      packageName: 'reskill',
      packageVersion: '0.17.0',
      skipNetwork: true,
      skipConfigChecks: false,
    });

    // Should include config check results
    const checkNames = results.map((r) => r.name);
    expect(checkNames).toContain('Registry conflict');
    expect(checkNames).toContain('Invalid agent');
    expect(checkNames).toContain('Version mismatch');
  });
});
