import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CLAUDE_3P_SKILLS_PLUGIN_BASE_ENV,
  CLAUDE_3P_SKILLS_ROOT_ENV,
  findClaude3pSkillsRoots,
  getClaude3pSkillPath,
  getClaude3pSkillsPluginBase,
  installClaude3pSkill,
  listClaude3pSkills,
  resolveClaude3pSkillsRoot,
  uninstallClaude3pSkill,
} from './claude-3p-installer.js';

describe('claude-3p-installer', () => {
  let tempDir: string;
  let sourceDir: string;
  let skillsRoot: string;
  let originalRoot: string | undefined;
  let originalBase: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'claude-3p-installer-test-'));
    skillsRoot = path.join(tempDir, 'skills-plugin', 'org', 'account');
    mkdirSync(path.join(skillsRoot, 'skills'), { recursive: true });
    writeFileSync(path.join(skillsRoot, 'manifest.json'), '{"skills":[]}\n');

    sourceDir = path.join(tempDir, 'source');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(
      path.join(sourceDir, 'SKILL.md'),
      `---
name: test-skill
description: Test skill for Claude Cowork 3P
---

# Test Skill
`,
    );
    writeFileSync(path.join(sourceDir, 'helper.md'), '# Helper');
    writeFileSync(path.join(sourceDir, 'README.md'), '# Excluded');

    originalRoot = process.env[CLAUDE_3P_SKILLS_ROOT_ENV];
    originalBase = process.env[CLAUDE_3P_SKILLS_PLUGIN_BASE_ENV];
    process.env[CLAUDE_3P_SKILLS_ROOT_ENV] = skillsRoot;
    delete process.env[CLAUDE_3P_SKILLS_PLUGIN_BASE_ENV];
  });

  afterEach(() => {
    if (originalRoot === undefined) {
      delete process.env[CLAUDE_3P_SKILLS_ROOT_ENV];
    } else {
      process.env[CLAUDE_3P_SKILLS_ROOT_ENV] = originalRoot;
    }

    if (originalBase === undefined) {
      delete process.env[CLAUDE_3P_SKILLS_PLUGIN_BASE_ENV];
    } else {
      process.env[CLAUDE_3P_SKILLS_PLUGIN_BASE_ENV] = originalBase;
    }

    rmSync(tempDir, { recursive: true, force: true });
  });

  it('derives the platform-specific skills-plugin base path', () => {
    expect(
      getClaude3pSkillsPluginBase({
        platform: 'darwin',
        homeDir: '/Users/alice',
        env: {},
      }),
    ).toBe(
      path.join(
        '/Users/alice',
        'Library',
        'Application Support',
        'Claude-3p',
        'local-agent-mode-sessions',
        'skills-plugin',
      ),
    );

    expect(
      getClaude3pSkillsPluginBase({
        platform: 'win32',
        homeDir: 'C:\\Users\\Alice',
        env: { APPDATA: 'C:\\Users\\Alice\\AppData\\Roaming' },
      }),
    ).toBe(
      path.join(
        'C:\\Users\\Alice\\AppData\\Roaming',
        'Claude-3p',
        'local-agent-mode-sessions',
        'skills-plugin',
      ),
    );
  });

  it('resolves an explicit Claude Cowork 3P skills root', () => {
    expect(resolveClaude3pSkillsRoot()).toBe(skillsRoot);
    expect(findClaude3pSkillsRoots()).toEqual([skillsRoot]);
  });

  it('installs a skill and updates Claude Cowork 3P manifest.json', () => {
    const result = installClaude3pSkill(sourceDir, 'fallback-skill', { mode: 'symlink' });

    expect(result.success).toBe(true);
    expect(result.mode).toBe('copy');
    expect(result.symlinkFailed).toBeUndefined();
    expect(result.path).toBe(path.join(skillsRoot, 'skills', 'test-skill'));
    expect(existsSync(path.join(result.path, 'SKILL.md'))).toBe(true);
    expect(existsSync(path.join(result.path, 'helper.md'))).toBe(true);
    expect(existsSync(path.join(result.path, 'README.md'))).toBe(false);

    const manifest = JSON.parse(readFileSync(path.join(skillsRoot, 'manifest.json'), 'utf-8'));
    expect(manifest.skills).toHaveLength(1);
    expect(manifest.skills[0]).toMatchObject({
      skillId: 'test-skill',
      name: 'test-skill',
      description: 'Test skill for Claude Cowork 3P',
      creatorType: 'user',
      syncManaged: false,
      enabled: true,
    });
    expect(typeof manifest.lastUpdated).toBe('number');
  });

  it('uninstalls a skill and removes it from manifest.json', () => {
    installClaude3pSkill(sourceDir, 'fallback-skill', { mode: 'copy' });

    expect(listClaude3pSkills()).toEqual(['test-skill']);
    expect(uninstallClaude3pSkill('test-skill')).toBe(true);
    expect(listClaude3pSkills()).toEqual([]);

    const manifest = JSON.parse(readFileSync(path.join(skillsRoot, 'manifest.json'), 'utf-8'));
    expect(manifest.skills).toEqual([]);
  });

  it('rejects unsafe skill names that could escape the skills directory', () => {
    writeFileSync(
      path.join(sourceDir, 'SKILL.md'),
      `---
name: ..
description: Unsafe skill
---

# Unsafe Skill
`,
    );

    const result = installClaude3pSkill(sourceDir, 'fallback-skill', { mode: 'copy' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not safe');
    expect(existsSync(path.join(skillsRoot, 'skills'))).toBe(true);
    expect(
      JSON.parse(readFileSync(path.join(skillsRoot, 'manifest.json'), 'utf-8')).skills,
    ).toEqual([]);
    expect(() => getClaude3pSkillPath('..')).toThrow('not safe');
    expect(() => uninstallClaude3pSkill('.')).toThrow('not safe');
  });

  it('keeps only recent Claude Cowork 3P manifest backups', () => {
    for (let index = 0; index < 12; index++) {
      installClaude3pSkill(sourceDir, 'fallback-skill', { mode: 'copy' });
    }

    const backups = readdirSync(skillsRoot).filter((name) => name.startsWith('manifest.json.bak.'));
    expect(backups.length).toBeLessThanOrEqual(10);
  });

  it('rolls back files when manifest update fails', () => {
    installClaude3pSkill(sourceDir, 'fallback-skill', { mode: 'copy' });
    writeFileSync(path.join(sourceDir, 'helper.md'), '# Updated helper');
    writeFileSync(path.join(skillsRoot, 'manifest.json'), '{broken');

    const result = installClaude3pSkill(sourceDir, 'fallback-skill', { mode: 'copy' });

    expect(result.success).toBe(false);
    expect(readFileSync(path.join(skillsRoot, 'skills', 'test-skill', 'helper.md'), 'utf-8')).toBe(
      '# Helper',
    );
    expect(
      readdirSync(path.join(skillsRoot, 'skills')).filter((name) =>
        name.includes('test-skill.rollback'),
      ),
    ).toEqual([]);
  });
});
