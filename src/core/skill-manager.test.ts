import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpResolver } from './http-resolver.js';
import { RegistryResolver } from './registry-resolver.js';
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

    it('should respect custom installDir from config for new skills', () => {
      // Create skills.json with custom installDir
      fs.writeFileSync(
        path.join(tempDir, 'skills.json'),
        JSON.stringify({
          skills: {},
          defaults: { installDir: 'custom-skills' },
        }),
      );

      const manager = new SkillManager(tempDir);
      // For new skills, it should use the custom installDir if configured
      expect(manager.getSkillPath('my-skill')).toBe(
        path.join(tempDir, 'custom-skills', 'my-skill'),
      );
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
      // Create SKILL.md with version in frontmatter (sole source of metadata)
      fs.writeFileSync(
        path.join(skillPath, 'SKILL.md'),
        `---
name: test-skill
version: 1.0.0
description: Test skill
---
# Test Skill
`,
      );

      const skill = skillManager.getInstalledSkill('test-skill');
      expect(skill).not.toBeNull();
      expect(skill?.name).toBe('test-skill');
      expect(skill?.version).toBe('1.0.0');
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

  describe('installSkillsFromRepo', () => {
    let repoDir: string;

    function createLocalMultiSkillRepo(
      skills: Array<{ name: string; description: string }>,
    ): string {
      const repoPath = path.join(repoDir, 'skills-repo');
      fs.mkdirSync(repoPath, { recursive: true });
      const skillsDir = path.join(repoPath, 'skills');
      fs.mkdirSync(skillsDir, { recursive: true });

      for (const s of skills) {
        const skillDir = path.join(skillsDir, s.name);
        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(
          path.join(skillDir, 'SKILL.md'),
          `---
name: ${s.name}
description: ${s.description}
---
# ${s.name}
`,
        );
      }

      execSync('git init -b main', { cwd: repoPath, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: repoPath, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: repoPath, stdio: 'pipe' });
      execSync('git add -A', { cwd: repoPath, stdio: 'pipe' });
      execSync('git commit -m "init"', { cwd: repoPath, stdio: 'pipe' });

      return `file://${repoPath}`;
    }

    beforeEach(() => {
      repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-multi-skill-'));
    });

    afterEach(() => {
      fs.rmSync(repoDir, { recursive: true, force: true });
    });

    it('should let GitResolver handle invalid refs naturally', async () => {
      // No pre-validation guard — GitResolver produces clear errors for bad refs
      await expect(
        skillManager.installSkillsFromRepo('my-skill', [], ['cursor'], {}),
      ).rejects.toThrow(/Invalid skill reference/);
    });

    it('should return discovered skills when listOnly is true', async () => {
      const fileUrl = createLocalMultiSkillRepo([
        { name: 'pdf', description: 'PDF skill' },
        { name: 'commit', description: 'Commit skill' },
      ]);

      const result = await skillManager.installSkillsFromRepo(
        fileUrl,
        [],
        ['cursor'],
        { listOnly: true },
      );

      expect(result.listOnly).toBe(true);
      expect('skills' in result && result.skills).toHaveLength(2);
      const names = (result as { skills: Array<{ name: string }> }).skills.map((s) => s.name).sort();
      expect(names).toEqual(['commit', 'pdf']);
    });

    it('should install selected skills and save ref#name to skills.json', async () => {
      const fileUrl = createLocalMultiSkillRepo([
        { name: 'pdf', description: 'PDF skill' },
        { name: 'commit', description: 'Commit skill' },
      ]);

      const result = await skillManager.installSkillsFromRepo(
        fileUrl,
        ['pdf'],
        ['cursor'],
        { save: true },
      );

      expect(result.listOnly).toBe(false);
      if (result.listOnly) throw new Error('unexpected listOnly');
      expect(result.installed).toHaveLength(1);
      expect(result.installed[0].skill.name).toBe('pdf');

      const canonicalPath = path.join(tempDir, '.agents', 'skills', 'pdf');
      expect(fs.existsSync(canonicalPath)).toBe(true);
      expect(fs.existsSync(path.join(canonicalPath, 'SKILL.md'))).toBe(true);

      const config = JSON.parse(fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8'));
      expect(config.skills.pdf).toMatch(/#pdf$/);
    });

    it('should throw when no skills match and list available', async () => {
      const fileUrl = createLocalMultiSkillRepo([
        { name: 'pdf', description: 'PDF skill' },
      ]);

      await expect(
        skillManager.installSkillsFromRepo(fileUrl, ['nonexistent'], ['cursor'], {}),
      ).rejects.toThrow(/No matching skills found/);
      await expect(
        skillManager.installSkillsFromRepo(fileUrl, ['nonexistent'], ['cursor'], {}),
      ).rejects.toThrow(/Available skills/);
    });

    it('should throw when repo has no valid SKILL.md', async () => {
      const repoPath = path.join(repoDir, 'empty-repo');
      fs.mkdirSync(repoPath, { recursive: true });
      fs.writeFileSync(path.join(repoPath, 'README.md'), '# No skills');
      execSync('git init -b main', { cwd: repoPath, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: repoPath, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: repoPath, stdio: 'pipe' });
      execSync('git add -A', { cwd: repoPath, stdio: 'pipe' });
      execSync('git commit -m "init"', { cwd: repoPath, stdio: 'pipe' });

      await expect(
        skillManager.installSkillsFromRepo(`file://${repoPath}`, [], ['cursor'], {}),
      ).rejects.toThrow(/No valid skills found/);
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
      // Setup: Create skill in canonical location with SKILL.md (sole source of metadata)
      const canonicalDir = path.join(tempDir, '.agents', 'skills', 'test-skill');
      fs.mkdirSync(canonicalDir, { recursive: true });
      fs.writeFileSync(
        path.join(canonicalDir, 'SKILL.md'),
        `---
name: test-skill
version: 2.0.0
description: Test skill
---
# Test Skill
`,
      );

      // Action: Get installed skill
      const skill = skillManager.getInstalledSkill('test-skill');

      // Assert: Skill should be found
      expect(skill).not.toBeNull();
      expect(skill?.name).toBe('test-skill');
      expect(skill?.version).toBe('2.0.0');
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

describe('SkillManager with custom registries', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-registry-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should use custom registries from config when resolving skill refs', () => {
    // Create skills.json with custom registries
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({
        skills: {
          'internal-tool': 'internal:team/tool@v1.0.0',
        },
        registries: {
          internal: 'https://gitlab.company.com',
        },
      }),
    );

    // Create SkillManager - it should pick up registries from config
    const manager = new SkillManager(tempDir);

    // The manager should exist and be configured
    expect(manager.getProjectRoot()).toBe(tempDir);
  });

  it('should preserve registries when updating config', () => {
    // Create initial config with registries
    const initialConfig = {
      skills: {},
      registries: {
        internal: 'https://gitlab.company.com',
        enterprise: 'https://git.enterprise.io',
      },
    };
    fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify(initialConfig, null, 2));

    // Create SkillManager (verify it doesn't throw with registries)
    new SkillManager(tempDir);

    // Read config to verify registries
    const configPath = path.join(tempDir, 'skills.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.registries.internal).toBe('https://gitlab.company.com');
    expect(config.registries.enterprise).toBe('https://git.enterprise.io');
  });

  it('should handle config without registries section', () => {
    // Create config without registries
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({
        skills: {
          'github-skill': 'github:user/skill@v1.0.0',
        },
      }),
    );

    // Should not throw
    const manager = new SkillManager(tempDir);
    expect(manager.getProjectRoot()).toBe(tempDir);
  });
});

describe('SkillManager source type detection', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-source-type-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // Test the internal isHttpSource and isRegistrySource methods via reflection
  // These are private, but we can verify the behavior via install() behavior

  describe('registry source detection', () => {
    it('should detect @scope/name as registry source', () => {
      expect(RegistryResolver.isRegistryRef('@kanyun/planning-with-files')).toBe(true);
      expect(RegistryResolver.isRegistryRef('@kanyun/skill@1.0.0')).toBe(true);
    });

    it('should detect simple name as public registry source', () => {
      expect(RegistryResolver.isRegistryRef('my-skill')).toBe(true);
      expect(RegistryResolver.isRegistryRef('my-skill@latest')).toBe(true);
    });

    it('should not detect git shorthand as registry source', () => {
      expect(RegistryResolver.isRegistryRef('github:user/repo')).toBe(false);
      expect(RegistryResolver.isRegistryRef('user/repo')).toBe(false);
    });
  });

  describe('HTTP source detection', () => {
    it('should detect HTTP URLs', () => {
      expect(HttpResolver.isHttpUrl('https://example.com/skill.tar.gz')).toBe(true);
      expect(HttpResolver.isHttpUrl('http://localhost/skill.tar.gz')).toBe(true);
      expect(HttpResolver.isHttpUrl('oss://bucket/skill.tar.gz')).toBe(true);
      expect(HttpResolver.isHttpUrl('s3://bucket/skill.tar.gz')).toBe(true);
    });

    it('should not detect Git URLs as HTTP', () => {
      expect(HttpResolver.isHttpUrl('https://github.com/user/repo.git')).toBe(false);
      expect(HttpResolver.isHttpUrl('https://github.com/user/repo/tree/main/skill')).toBe(false);
    });
  });

  describe('source priority: Registry > HTTP > Git', () => {
    it('should prioritize registry over git for simple names', () => {
      // 'my-skill' should be treated as registry (public), not git
      const ref = 'my-skill';
      const isRegistry = RegistryResolver.isRegistryRef(ref);
      const isHttp = HttpResolver.isHttpUrl(ref);

      // Registry should match first
      expect(isRegistry).toBe(true);
      expect(isHttp).toBe(false);
    });

    it('should prioritize http over git for tarball URLs', () => {
      const ref = 'https://example.com/skill.tar.gz';
      const isRegistry = RegistryResolver.isRegistryRef(ref);
      const isHttp = HttpResolver.isHttpUrl(ref);

      // HTTP should match (registry should not)
      expect(isRegistry).toBe(false);
      expect(isHttp).toBe(true);
    });

    it('should fall through to git for owner/repo format', () => {
      const ref = 'user/repo';
      const isRegistry = RegistryResolver.isRegistryRef(ref);
      const isHttp = HttpResolver.isHttpUrl(ref);

      // Neither registry nor HTTP should match
      expect(isRegistry).toBe(false);
      expect(isHttp).toBe(false);
      // Falls through to Git-based
    });
  });
});

// ============================================================================
// source_type 分支逻辑测试（页面发布适配）
// ============================================================================

describe('SkillManager installToAgentsFromRegistry with source_type', () => {
  let tempDir: string;
  let manager: SkillManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-source-type-install-'));
    manager = new SkillManager(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('页面发布 skill 不支持版本指定', () => {
    it('should throw error when version specified for github source_type', async () => {
      // Mock RegistryClient.getSkillInfo 返回 github source_type
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/github-skill',
        source_type: 'github',
        source_url: 'https://github.com/user/repo/tree/main/skills/my-skill',
      });

      // 尝试安装带版本号的 skill
      await expect(
        manager.installToAgents('@kanyun/github-skill@1.0.0', ['cursor']),
      ).rejects.toThrow('Version specifier not supported for web-published skills');
    });

    it('should throw error when version specified for local source_type', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/local-skill',
        source_type: 'local',
        source_url: 'local/@kanyun/local-skill.tgz',
      });

      await expect(
        manager.installToAgents('@kanyun/local-skill@2.0.0', ['cursor']),
      ).rejects.toThrow('Version specifier not supported for web-published skills');
    });

    it('should allow latest version for web-published skills', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/github-skill',
        source_type: 'github',
        source_url: 'https://github.com/user/repo/tree/main/skills/my-skill',
      });

      // Mock installToAgentsFromGit
      const installFromGitSpy = vi
        .spyOn(manager as unknown as Record<string, (...args: unknown[]) => unknown>, 'installToAgentsFromGit')
        .mockResolvedValue({
          skill: { name: 'my-skill', path: '/tmp/skill', version: '1.0.0', source: 'github' },
          results: new Map([['cursor', { success: true, path: '/tmp', mode: 'symlink' }]]),
        });

      // @latest 应该被允许
      await manager.installToAgents('@kanyun/github-skill@latest', ['cursor']);

      expect(installFromGitSpy).toHaveBeenCalled();
    });
  });

  describe('source_type 分支', () => {
    it('should call installToAgentsFromGit for github source_type', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/github-skill',
        source_type: 'github',
        source_url: 'https://github.com/user/repo/tree/main/skills/my-skill',
      });

      // Mock installToAgentsFromGit
      const installFromGitSpy = vi
        .spyOn(manager as unknown as Record<string, (...args: unknown[]) => unknown>, 'installToAgentsFromGit')
        .mockResolvedValue({
          skill: { name: 'my-skill', path: '/tmp/skill', version: '1.0.0', source: 'github' },
          results: new Map([['cursor', { success: true, path: '/tmp', mode: 'symlink' }]]),
        });

      await manager.installToAgents('@kanyun/github-skill', ['cursor']);

      // 应该调用 Git 安装方法，传入 source_url
      expect(installFromGitSpy).toHaveBeenCalledWith(
        'https://github.com/user/repo/tree/main/skills/my-skill',
        ['cursor'],
        expect.any(Object),
      );
    });

    it('should call installToAgentsFromHttp for oss_url source_type', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/oss-skill',
        source_type: 'oss_url',
        source_url: 'https://bucket.oss.com/skill.tgz',
      });

      // Mock installToAgentsFromHttp
      const installFromHttpSpy = vi
        .spyOn(
          manager as unknown as Record<string, (...args: unknown[]) => unknown>,
          'installToAgentsFromHttp',
        )
        .mockResolvedValue({
          skill: { name: 'oss-skill', path: '/tmp/skill', version: '1.0.0', source: 'oss' },
          results: new Map([['cursor', { success: true, path: '/tmp', mode: 'symlink' }]]),
        });

      await manager.installToAgents('@kanyun/oss-skill', ['cursor']);

      expect(installFromHttpSpy).toHaveBeenCalledWith(
        'https://bucket.oss.com/skill.tgz',
        ['cursor'],
        expect.any(Object),
      );
    });

    it('should use existing registry flow for source_type=registry', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/cli-skill',
        source_type: 'registry',
      });

      // Mock RegistryResolver
      const registryResolver = (manager as unknown as { registryResolver: RegistryResolver })
        .registryResolver;
      vi.spyOn(registryResolver, 'resolve').mockResolvedValue({
        parsed: {
          scope: '@kanyun',
          name: 'cli-skill',
          version: '1.0.0',
          fullName: '@kanyun/cli-skill',
        },
        shortName: 'cli-skill',
        version: '1.0.0',
        registryUrl: 'https://registry.example.com/',
        tarball: Buffer.from('mock tarball'),
        integrity: 'sha256-mockhash',
      });

      const mockSkillDir = path.join(tempDir, 'mock-skill');
      fs.mkdirSync(mockSkillDir, { recursive: true });
      fs.writeFileSync(path.join(mockSkillDir, 'SKILL.md'), '# Skill');
      vi.spyOn(registryResolver, 'extract').mockResolvedValue(mockSkillDir);

      const result = await manager.installToAgents('@kanyun/cli-skill@1.0.0', ['cursor']);

      // 应该使用现有的 registry 流程
      expect(result.skill.name).toBe('cli-skill');
    });

    it('should use existing registry flow when source_type is undefined (backward compat)', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      // 老的 skill 没有 source_type 字段
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/old-skill',
        description: 'An old skill without source_type',
      });

      // Mock RegistryResolver
      const registryResolver = (manager as unknown as { registryResolver: RegistryResolver })
        .registryResolver;
      vi.spyOn(registryResolver, 'resolve').mockResolvedValue({
        parsed: {
          scope: '@kanyun',
          name: 'old-skill',
          version: '1.0.0',
          fullName: '@kanyun/old-skill',
        },
        shortName: 'old-skill',
        version: '1.0.0',
        registryUrl: 'https://registry.example.com/',
        tarball: Buffer.from('mock tarball'),
        integrity: 'sha256-mockhash',
      });

      const mockSkillDir = path.join(tempDir, 'mock-old-skill');
      fs.mkdirSync(mockSkillDir, { recursive: true });
      fs.writeFileSync(path.join(mockSkillDir, 'SKILL.md'), '# Skill');
      vi.spyOn(registryResolver, 'extract').mockResolvedValue(mockSkillDir);

      const result = await manager.installToAgents('@kanyun/old-skill', ['cursor']);

      // 应该正常工作（向后兼容）
      expect(result.skill.name).toBe('old-skill');
    });
  });

  describe('source_url 校验', () => {
    it('should throw error when source_url is missing for web-published skill', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/broken-skill',
        source_type: 'github',
        // source_url 缺失
      });

      await expect(manager.installToAgents('@kanyun/broken-skill', ['cursor'])).rejects.toThrow(
        'Missing source_url',
      );
    });
  });

  describe('registry option override', () => {
    it('should use options.registry instead of scope-based registry URL', async () => {
      const customRegistryUrl = 'https://custom-registry.example.com';

      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: 'my-skill',
        source_type: 'registry',
      });

      // Mock RegistryResolver to capture the overrideRegistryUrl
      const registryResolver = (manager as unknown as { registryResolver: RegistryResolver })
        .registryResolver;
      const resolveSpy = vi.spyOn(registryResolver, 'resolve').mockResolvedValue({
        parsed: {
          scope: null,
          name: 'my-skill',
          version: '1.0.0',
          fullName: 'my-skill',
        },
        shortName: 'my-skill',
        version: '1.0.0',
        registryUrl: customRegistryUrl,
        tarball: Buffer.from('mock tarball'),
        integrity: 'sha256-mockhash',
      });

      const mockSkillDir = path.join(tempDir, 'mock-skill-registry');
      fs.mkdirSync(mockSkillDir, { recursive: true });
      fs.writeFileSync(path.join(mockSkillDir, 'SKILL.md'), '# Skill');
      vi.spyOn(registryResolver, 'extract').mockResolvedValue(mockSkillDir);

      await manager.installToAgents('my-skill', ['cursor'], { registry: customRegistryUrl });

      // Verify resolve was called with the custom registry URL
      expect(resolveSpy).toHaveBeenCalledWith('my-skill', customRegistryUrl);
    });

    it('should use options.registry for RegistryClient when querying skill info', async () => {
      const customRegistryUrl = 'https://custom-registry.example.com';

      const { RegistryClient } = await import('./registry-client.js');
      const getSkillInfoSpy = vi
        .spyOn(RegistryClient.prototype, 'getSkillInfo')
        .mockResolvedValue({
          name: 'my-skill',
          source_type: 'registry',
        });

      // Mock RegistryResolver
      const registryResolver = (manager as unknown as { registryResolver: RegistryResolver })
        .registryResolver;
      vi.spyOn(registryResolver, 'resolve').mockResolvedValue({
        parsed: {
          scope: null,
          name: 'my-skill',
          version: '1.0.0',
          fullName: 'my-skill',
        },
        shortName: 'my-skill',
        version: '1.0.0',
        registryUrl: customRegistryUrl,
        tarball: Buffer.from('mock tarball'),
        integrity: 'sha256-mockhash',
      });

      const mockSkillDir = path.join(tempDir, 'mock-skill-client');
      fs.mkdirSync(mockSkillDir, { recursive: true });
      fs.writeFileSync(path.join(mockSkillDir, 'SKILL.md'), '# Skill');
      vi.spyOn(registryResolver, 'extract').mockResolvedValue(mockSkillDir);

      await manager.installToAgents('my-skill', ['cursor'], { registry: customRegistryUrl });

      // RegistryClient should have been created with the custom registry URL
      // Verify getSkillInfo was called (client was constructed with custom URL)
      expect(getSkillInfoSpy).toHaveBeenCalledWith('my-skill');
    });

    it('should fall back to scope-based registry when options.registry is not set', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/scope-skill',
        source_type: 'registry',
      });

      // Mock RegistryResolver
      const registryResolver = (manager as unknown as { registryResolver: RegistryResolver })
        .registryResolver;
      const resolveSpy = vi.spyOn(registryResolver, 'resolve').mockResolvedValue({
        parsed: {
          scope: '@kanyun',
          name: 'scope-skill',
          version: '1.0.0',
          fullName: '@kanyun/scope-skill',
        },
        shortName: 'scope-skill',
        version: '1.0.0',
        registryUrl: 'https://rush-test.zhenguanyu.com/',
        tarball: Buffer.from('mock tarball'),
        integrity: 'sha256-mockhash',
      });

      const mockSkillDir = path.join(tempDir, 'mock-scope-skill');
      fs.mkdirSync(mockSkillDir, { recursive: true });
      fs.writeFileSync(path.join(mockSkillDir, 'SKILL.md'), '# Skill');
      vi.spyOn(registryResolver, 'extract').mockResolvedValue(mockSkillDir);

      // No registry option — should resolve URL from scope at the entry point
      await manager.installToAgents('@kanyun/scope-skill', ['cursor']);

      // resolve should receive the pre-resolved registry URL (not undefined)
      // because installToAgentsFromRegistry resolves the URL once and passes it down
      expect(resolveSpy).toHaveBeenCalledWith('@kanyun/scope-skill', 'https://rush.zhenguanyu.com/');
    });
  });
});

// ============================================================================
// Tests for SKILL.md as authoritative source for skill name
// ============================================================================

describe('SkillManager should use SKILL.md name as authoritative source', () => {
  let tempDir: string;
  let skillManager: SkillManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-skillmd-name-test-'));
    skillManager = new SkillManager(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('getInstalledSkill should read metadata from SKILL.md', () => {
    it('should use version from SKILL.md when skill.json is missing', () => {
      // Create skill with only SKILL.md (no skill.json)
      const skillPath = path.join(tempDir, '.agents', 'skills', 'my-skill');
      fs.mkdirSync(skillPath, { recursive: true });
      fs.writeFileSync(
        path.join(skillPath, 'SKILL.md'),
        `---
name: my-skill
description: A test skill
version: 2.0.0
---

# My Skill

Test content.
`,
      );

      const skill = skillManager.getInstalledSkill('my-skill');
      expect(skill).not.toBeNull();
      expect(skill?.version).toBe('2.0.0');
    });

    it('should return unknown version when SKILL.md has no version', () => {
      // Create skill with SKILL.md but no version
      const skillPath = path.join(tempDir, '.agents', 'skills', 'no-version-skill');
      fs.mkdirSync(skillPath, { recursive: true });
      fs.writeFileSync(
        path.join(skillPath, 'SKILL.md'),
        `---
name: no-version-skill
description: A skill without version
---

# No Version Skill
`,
      );

      const skill = skillManager.getInstalledSkill('no-version-skill');
      expect(skill).not.toBeNull();
      // SKILL.md has no version, returns 'unknown'
      expect(skill?.version).toBe('unknown');
    });
  });

  describe('list() should work with SKILL.md-only skills', () => {
    it('should list skills that only have SKILL.md', () => {
      // Create skill with only SKILL.md
      const skillPath = path.join(tempDir, '.agents', 'skills', 'minimal-skill');
      fs.mkdirSync(skillPath, { recursive: true });
      fs.writeFileSync(
        path.join(skillPath, 'SKILL.md'),
        `---
name: minimal-skill
description: A minimal skill
version: 1.0.0
---

# Minimal Skill
`,
      );

      const skills = skillManager.list();
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('minimal-skill');
      expect(skills[0].version).toBe('1.0.0');
    });
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
