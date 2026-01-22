import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SkillManager } from './skill-manager.js';

describe('SkillManager', () => {
  let tempDir: string;
  let skillManager: SkillManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-skill-manager-test-'));
    skillManager = new SkillManager(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should use current directory when no projectRoot provided', () => {
      const manager = new SkillManager();
      expect(manager.getProjectRoot()).toBe(process.cwd());
    });

    it('should use provided projectRoot', () => {
      expect(skillManager.getProjectRoot()).toBe(tempDir);
    });

    it('should default to non-global mode', () => {
      expect(skillManager.isGlobalMode()).toBe(false);
    });

    it('should accept global option', () => {
      const globalManager = new SkillManager(tempDir, { global: true });
      expect(globalManager.isGlobalMode()).toBe(true);
    });
  });

  describe('getProjectRoot', () => {
    it('should return project root', () => {
      expect(skillManager.getProjectRoot()).toBe(tempDir);
    });
  });

  describe('getInstallDir', () => {
    it('should return default install directory', () => {
      expect(skillManager.getInstallDir()).toBe(path.join(tempDir, '.skills'));
    });

    it('should return global install directory when in global mode', () => {
      const globalManager = new SkillManager(tempDir, { global: true });
      const home = process.env.HOME || process.env.USERPROFILE || '';
      expect(globalManager.getInstallDir()).toBe(path.join(home, '.claude', 'skills'));
    });

    it('should use config installDir when available', () => {
      // Create skills.json with custom installDir
      fs.writeFileSync(
        path.join(tempDir, 'skills.json'),
        JSON.stringify({
          skills: {},
          defaults: { installDir: 'custom-skills' },
        }),
      );

      const manager = new SkillManager(tempDir);
      expect(manager.getInstallDir()).toBe(path.join(tempDir, 'custom-skills'));
    });
  });

  describe('isGlobalMode', () => {
    it('should return false by default', () => {
      expect(skillManager.isGlobalMode()).toBe(false);
    });

    it('should return true when global option is set', () => {
      const globalManager = new SkillManager(tempDir, { global: true });
      expect(globalManager.isGlobalMode()).toBe(true);
    });
  });

  describe('getSkillPath', () => {
    it('should return canonical skill path for new skills', () => {
      // For new skills (not yet installed), getSkillPath returns canonical location
      expect(skillManager.getSkillPath('my-skill')).toBe(
        path.join(tempDir, '.agents', 'skills', 'my-skill'),
      );
    });

    it('should return legacy path if skill exists there', () => {
      // Create skill in legacy location
      const legacyPath = path.join(tempDir, '.skills', 'legacy-skill');
      fs.mkdirSync(legacyPath, { recursive: true });
      fs.writeFileSync(path.join(legacyPath, 'skill.json'), '{}');

      expect(skillManager.getSkillPath('legacy-skill')).toBe(legacyPath);
    });

    it('should return canonical path if skill exists there', () => {
      // Create skill in canonical location
      const canonicalPath = path.join(tempDir, '.agents', 'skills', 'canonical-skill');
      fs.mkdirSync(canonicalPath, { recursive: true });
      fs.writeFileSync(path.join(canonicalPath, 'skill.json'), '{}');

      expect(skillManager.getSkillPath('canonical-skill')).toBe(canonicalPath);
    });

    it('should handle nested skill names', () => {
      expect(skillManager.getSkillPath('my-org/my-skill')).toBe(
        path.join(tempDir, '.agents', 'skills', 'my-org/my-skill'),
      );
    });
  });

  describe('list', () => {
    it('should return empty array when no skills installed', () => {
      expect(skillManager.list()).toEqual([]);
    });

    it('should return empty array when install dir does not exist', () => {
      expect(skillManager.list()).toEqual([]);
    });

    it('should return installed skills', () => {
      const skillsDir = path.join(tempDir, '.skills');
      const skillPath = path.join(skillsDir, 'test-skill');

      fs.mkdirSync(skillPath, { recursive: true });
      fs.writeFileSync(
        path.join(skillPath, 'skill.json'),
        JSON.stringify({ name: 'test-skill', version: '1.0.0' }),
      );

      const skills = skillManager.list();
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('test-skill');
    });

    it('should return multiple skills', () => {
      const skillsDir = path.join(tempDir, '.skills');

      // Create skill 1
      const skill1Path = path.join(skillsDir, 'skill-1');
      fs.mkdirSync(skill1Path, { recursive: true });
      fs.writeFileSync(
        path.join(skill1Path, 'skill.json'),
        JSON.stringify({ name: 'skill-1', version: '1.0.0' }),
      );

      // Create skill 2
      const skill2Path = path.join(skillsDir, 'skill-2');
      fs.mkdirSync(skill2Path, { recursive: true });
      fs.writeFileSync(
        path.join(skill2Path, 'skill.json'),
        JSON.stringify({ name: 'skill-2', version: '2.0.0' }),
      );

      const skills = skillManager.list();
      expect(skills).toHaveLength(2);
    });

    it('should ignore files in skills directory', () => {
      const skillsDir = path.join(tempDir, '.skills');
      fs.mkdirSync(skillsDir, { recursive: true });

      // Create a file instead of directory
      fs.writeFileSync(path.join(skillsDir, 'not-a-skill.txt'), 'test');

      // Create actual skill directory
      const skillPath = path.join(skillsDir, 'real-skill');
      fs.mkdirSync(skillPath);
      fs.writeFileSync(path.join(skillPath, 'skill.json'), '{}');

      const skills = skillManager.list();
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('real-skill');
    });
  });

  describe('getInstalledSkill', () => {
    it('should return null for non-installed skill', () => {
      expect(skillManager.getInstalledSkill('non-existent')).toBeNull();
    });

    it('should return skill info for installed skill', () => {
      const skillsDir = path.join(tempDir, '.skills');
      const skillPath = path.join(skillsDir, 'test-skill');

      fs.mkdirSync(skillPath, { recursive: true });
      fs.writeFileSync(
        path.join(skillPath, 'skill.json'),
        JSON.stringify({ name: 'test-skill', version: '1.0.0', description: 'Test skill' }),
      );

      const skill = skillManager.getInstalledSkill('test-skill');
      expect(skill).not.toBeNull();
      expect(skill?.name).toBe('test-skill');
      expect(skill?.metadata?.version).toBe('1.0.0');
    });

    it('should handle skill without skill.json', () => {
      const skillsDir = path.join(tempDir, '.skills');
      const skillPath = path.join(skillsDir, 'minimal-skill');

      fs.mkdirSync(skillPath, { recursive: true });
      fs.writeFileSync(path.join(skillPath, 'SKILL.md'), '# Skill');

      const skill = skillManager.getInstalledSkill('minimal-skill');
      expect(skill).not.toBeNull();
      expect(skill?.name).toBe('minimal-skill');
      expect(skill?.version).toBe('unknown');
    });

    it('should handle invalid skill.json gracefully', () => {
      const skillsDir = path.join(tempDir, '.skills');
      const skillPath = path.join(skillsDir, 'bad-skill');

      fs.mkdirSync(skillPath, { recursive: true });
      fs.writeFileSync(path.join(skillPath, 'skill.json'), 'not valid json');

      const skill = skillManager.getInstalledSkill('bad-skill');
      expect(skill).not.toBeNull();
      expect(skill?.name).toBe('bad-skill');
      expect(skill?.metadata).toBeUndefined();
    });
  });

  describe('uninstall', () => {
    it('should uninstall skill', () => {
      const skillPath = path.join(tempDir, '.skills', 'test-skill');
      fs.mkdirSync(skillPath, { recursive: true });
      fs.writeFileSync(path.join(skillPath, 'skill.json'), '{}');

      // Create skills.json
      fs.writeFileSync(
        path.join(tempDir, 'skills.json'),
        JSON.stringify({ skills: { 'test-skill': 'github:user/test-skill@v1.0.0' } }),
      );

      const result = skillManager.uninstall('test-skill');

      expect(result).toBe(true);
      expect(fs.existsSync(skillPath)).toBe(false);
    });

    it('should return false for non-installed skill', () => {
      expect(skillManager.uninstall('non-existent')).toBe(false);
    });

    it('should remove from skills.json', () => {
      const skillPath = path.join(tempDir, '.skills', 'test-skill');
      fs.mkdirSync(skillPath, { recursive: true });
      fs.writeFileSync(path.join(skillPath, 'skill.json'), '{}');

      fs.writeFileSync(
        path.join(tempDir, 'skills.json'),
        JSON.stringify({
          skills: {
            'test-skill': 'github:user/test-skill@v1.0.0',
            'other-skill': 'github:user/other@v1.0.0',
          },
        }),
      );

      skillManager.uninstall('test-skill');

      const config = JSON.parse(fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8'));
      expect(config.skills['test-skill']).toBeUndefined();
      expect(config.skills['other-skill']).toBeDefined();
    });
  });

  describe('getInfo', () => {
    it('should return skill info', () => {
      // Create skills.json
      fs.writeFileSync(
        path.join(tempDir, 'skills.json'),
        JSON.stringify({ skills: { 'test-skill': 'github:user/test-skill@v1.0.0' } }),
      );

      const info = skillManager.getInfo('test-skill');
      expect(info.config).toBe('github:user/test-skill@v1.0.0');
      expect(info.installed).toBeNull(); // Not installed yet
    });

    it('should return null for unknown skill', () => {
      const info = skillManager.getInfo('unknown');
      expect(info.config).toBeUndefined();
      expect(info.installed).toBeNull();
      expect(info.locked).toBeUndefined();
    });

    it('should include installed info', () => {
      const skillPath = path.join(tempDir, '.skills', 'test-skill');
      fs.mkdirSync(skillPath, { recursive: true });
      fs.writeFileSync(
        path.join(skillPath, 'skill.json'),
        JSON.stringify({ name: 'test-skill', version: '1.0.0' }),
      );

      const info = skillManager.getInfo('test-skill');
      expect(info.installed).not.toBeNull();
      expect(info.installed?.name).toBe('test-skill');
    });

    it('should include locked info', () => {
      // Create skills.lock
      fs.writeFileSync(
        path.join(tempDir, 'skills.lock'),
        JSON.stringify({
          version: 1,
          skills: {
            'test-skill': {
              source: 'github:user/test-skill',
              version: 'v1.0.0',
              resolved: 'https://github.com/user/test-skill.git',
              commit: 'abc123',
              installedAt: '2024-01-01T00:00:00Z',
            },
          },
        }),
      );

      const info = skillManager.getInfo('test-skill');
      expect(info.locked).toBeDefined();
      expect(info.locked?.version).toBe('v1.0.0');
    });
  });

  describe('Multi-Agent methods', () => {
    describe('getAllAgentTypes', () => {
      it('should return all agent types', () => {
        const types = skillManager.getAllAgentTypes();
        expect(Array.isArray(types)).toBe(true);
        expect(types.length).toBe(17);
        expect(types).toContain('cursor');
        expect(types).toContain('claude-code');
      });
    });

    describe('validateAgentTypes', () => {
      it('should validate correct agent types', () => {
        const result = skillManager.validateAgentTypes(['cursor', 'claude-code']);
        expect(result.valid).toEqual(['cursor', 'claude-code']);
        expect(result.invalid).toEqual([]);
      });

      it('should identify invalid agent types', () => {
        const result = skillManager.validateAgentTypes(['cursor', 'invalid', 'vscode']);
        expect(result.valid).toEqual(['cursor']);
        expect(result.invalid).toEqual(['invalid', 'vscode']);
      });

      it('should handle empty array', () => {
        const result = skillManager.validateAgentTypes([]);
        expect(result.valid).toEqual([]);
        expect(result.invalid).toEqual([]);
      });
    });

    describe('getDefaultInstallMode', () => {
      it('should return symlink by default', () => {
        expect(skillManager.getDefaultInstallMode()).toBe('symlink');
      });

      it('should return config value if set', () => {
        fs.writeFileSync(
          path.join(tempDir, 'skills.json'),
          JSON.stringify({
            skills: {},
            defaults: { installMode: 'copy' },
          }),
        );

        const manager = new SkillManager(tempDir);
        expect(manager.getDefaultInstallMode()).toBe('copy');
      });
    });

    describe('getDefaultTargetAgents', () => {
      it('should return detected agents by default', async () => {
        const agents = await skillManager.getDefaultTargetAgents();
        expect(Array.isArray(agents)).toBe(true);
      });

      it('should return config value if set', async () => {
        fs.writeFileSync(
          path.join(tempDir, 'skills.json'),
          JSON.stringify({
            skills: {},
            defaults: { targetAgents: ['cursor', 'windsurf'] },
          }),
        );

        const manager = new SkillManager(tempDir);
        const agents = await manager.getDefaultTargetAgents();
        expect(agents).toEqual(['cursor', 'windsurf']);
      });

      it('should filter invalid agents from config', async () => {
        fs.writeFileSync(
          path.join(tempDir, 'skills.json'),
          JSON.stringify({
            skills: {},
            defaults: { targetAgents: ['cursor', 'invalid-agent', 'windsurf'] },
          }),
        );

        const manager = new SkillManager(tempDir);
        const agents = await manager.getDefaultTargetAgents();
        expect(agents).toEqual(['cursor', 'windsurf']);
        expect(agents).not.toContain('invalid-agent');
      });
    });
  });

  describe('installAll', () => {
    it('should return empty array when no skills in config', async () => {
      fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify({ skills: {} }));

      const installed = await skillManager.installAll();
      expect(installed).toEqual([]);
    });
  });
});

// Bug fix tests - These tests reproduce bugs before fixing them
describe('SkillManager bug fixes', () => {
  let tempDir: string;
  let skillManager: SkillManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-bugfix-test-'));
    skillManager = new SkillManager(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('list() should find skills in canonical directory', () => {
    // Bug: list() was checking .skills/ instead of .agents/skills/
    // The installToAgents() method installs to .agents/skills/ (canonical location)
    // but list() was only checking .skills/ (config installDir)

    it('should find skills installed to .agents/skills/ (canonical location)', () => {
      // Setup: Create skill in canonical location (where installToAgents puts it)
      const canonicalDir = path.join(tempDir, '.agents', 'skills', 'pdf');
      fs.mkdirSync(canonicalDir, { recursive: true });
      fs.writeFileSync(
        path.join(canonicalDir, 'skill.json'),
        JSON.stringify({ name: 'pdf', version: '1.0.0' }),
      );
      fs.writeFileSync(path.join(canonicalDir, 'SKILL.md'), '# PDF Skill');

      // Action: Call list()
      const skills = skillManager.list();

      // Assert: Skill should be found
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('pdf');
    });

    it('should find skills in both canonical and legacy locations', () => {
      // Create skill in canonical location (.agents/skills/)
      const canonicalDir = path.join(tempDir, '.agents', 'skills', 'canonical-skill');
      fs.mkdirSync(canonicalDir, { recursive: true });
      fs.writeFileSync(
        path.join(canonicalDir, 'skill.json'),
        JSON.stringify({ name: 'canonical-skill', version: '1.0.0' }),
      );

      // Create skill in legacy location (.skills/)
      const legacyDir = path.join(tempDir, '.skills', 'legacy-skill');
      fs.mkdirSync(legacyDir, { recursive: true });
      fs.writeFileSync(
        path.join(legacyDir, 'skill.json'),
        JSON.stringify({ name: 'legacy-skill', version: '1.0.0' }),
      );

      const skills = skillManager.list();

      expect(skills).toHaveLength(2);
      const names = skills.map((s) => s.name);
      expect(names).toContain('canonical-skill');
      expect(names).toContain('legacy-skill');
    });

    it('should not duplicate skills that exist in both locations', () => {
      // Create skill in canonical location
      const canonicalDir = path.join(tempDir, '.agents', 'skills', 'shared-skill');
      fs.mkdirSync(canonicalDir, { recursive: true });
      fs.writeFileSync(
        path.join(canonicalDir, 'skill.json'),
        JSON.stringify({ name: 'shared-skill', version: '1.0.0' }),
      );

      // Create symlink in legacy location pointing to canonical
      const legacyDir = path.join(tempDir, '.skills');
      fs.mkdirSync(legacyDir, { recursive: true });
      fs.symlinkSync(canonicalDir, path.join(legacyDir, 'shared-skill'));

      const skills = skillManager.list();

      // Should only list once, not twice
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('shared-skill');
    });
  });

  describe('getInstalledSkill() should find skills in canonical directory', () => {
    it('should find skill installed to .agents/skills/', () => {
      // Setup: Create skill in canonical location
      const canonicalDir = path.join(tempDir, '.agents', 'skills', 'test-skill');
      fs.mkdirSync(canonicalDir, { recursive: true });
      fs.writeFileSync(
        path.join(canonicalDir, 'skill.json'),
        JSON.stringify({ name: 'test-skill', version: '2.0.0' }),
      );

      // Action: Get installed skill
      const skill = skillManager.getInstalledSkill('test-skill');

      // Assert: Skill should be found
      expect(skill).not.toBeNull();
      expect(skill?.name).toBe('test-skill');
      expect(skill?.metadata?.version).toBe('2.0.0');
    });
  });

  describe('getSkillPath() should return canonical path', () => {
    it('should return path in .agents/skills/ for installed skills', () => {
      // When skill is installed via installToAgents, it goes to .agents/skills/
      // getSkillPath should reflect this
      const skillPath = skillManager.getSkillPath('my-skill');

      // After fix, this should point to canonical location
      expect(skillPath).toContain('.agents/skills/my-skill');
    });
  });
});

// Tests for update() behavior - checking remote before reinstalling
describe('SkillManager update() should check remote before reinstalling', () => {
  let tempDir: string;
  let skillManager: SkillManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-update-test-'));
    skillManager = new SkillManager(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should skip update when remote commit matches local lock', async () => {
    // Setup: Create skills.json
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({
        skills: { 'test-skill': 'github:user/test-skill@main' },
      }),
    );

    // Setup: Create skills.lock with a commit hash
    const testCommit = 'abc123def456789012345678901234567890abcd';
    fs.writeFileSync(
      path.join(tempDir, 'skills.lock'),
      JSON.stringify({
        lockfileVersion: 1,
        skills: {
          'test-skill': {
            source: 'github:user/test-skill',
            version: 'main',
            ref: 'main',
            resolved: 'https://github.com/user/test-skill.git',
            commit: testCommit,
            installedAt: new Date().toISOString(),
          },
        },
      }),
    );

    // Create skill in canonical location
    const skillDir = path.join(tempDir, '.agents', 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test Skill');

    // Action: Call checkNeedsUpdate with same commit
    const needsUpdate = await skillManager.checkNeedsUpdate('test-skill', testCommit);

    // Assert: Should not need update when commits match
    expect(needsUpdate).toBe(false);
  });

  it('should update when remote commit differs from local lock', async () => {
    // Setup: Create skills.json
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({
        skills: { 'test-skill': 'github:user/test-skill@main' },
      }),
    );

    // Setup: Create skills.lock with a commit hash
    const localCommit = 'abc123def456789012345678901234567890abcd';
    const remoteCommit = 'def456789012345678901234567890abcdef123';
    fs.writeFileSync(
      path.join(tempDir, 'skills.lock'),
      JSON.stringify({
        lockfileVersion: 1,
        skills: {
          'test-skill': {
            source: 'github:user/test-skill',
            version: 'main',
            ref: 'main',
            resolved: 'https://github.com/user/test-skill.git',
            commit: localCommit,
            installedAt: new Date().toISOString(),
          },
        },
      }),
    );

    // Action: Call checkNeedsUpdate with different commit
    const needsUpdate = await skillManager.checkNeedsUpdate('test-skill', remoteCommit);

    // Assert: Should need update when commits differ
    expect(needsUpdate).toBe(true);
  });

  it('should update when no local lock exists', async () => {
    // Setup: Create skills.json only (no lock file)
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({
        skills: { 'test-skill': 'github:user/test-skill@main' },
      }),
    );

    // Action: Call checkNeedsUpdate
    const remoteCommit = 'abc123def456789012345678901234567890abcd';
    const needsUpdate = await skillManager.checkNeedsUpdate('test-skill', remoteCommit);

    // Assert: Should need update when no lock info exists
    expect(needsUpdate).toBe(true);
  });

  it('should update when lock exists but has no commit hash', async () => {
    // Setup: Create skills.json
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({
        skills: { 'test-skill': 'github:user/test-skill@main' },
      }),
    );

    // Setup: Create skills.lock without commit hash (legacy format)
    fs.writeFileSync(
      path.join(tempDir, 'skills.lock'),
      JSON.stringify({
        lockfileVersion: 1,
        skills: {
          'test-skill': {
            source: 'github:user/test-skill',
            version: 'main',
            ref: 'main',
            resolved: 'https://github.com/user/test-skill.git',
            // No commit field
            installedAt: new Date().toISOString(),
          },
        },
      }),
    );

    // Action: Call checkNeedsUpdate
    const remoteCommit = 'abc123def456789012345678901234567890abcd';
    const needsUpdate = await skillManager.checkNeedsUpdate('test-skill', remoteCommit);

    // Assert: Should need update when no commit in lock
    expect(needsUpdate).toBe(true);
  });
});

// Integration tests (require network)
describe('SkillManager integration', () => {
  it.skip('should install from real repository', async () => {
    // This test requires network access
  });

  it.skip('should update skill', async () => {
    // This test requires network access
  });

  it.skip('should check outdated skills', async () => {
    // This test requires network access
  });

  it.skip('should install to multiple agents', async () => {
    // This test requires network access
  });
});
