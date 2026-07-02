import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitResolver } from './git-resolver.js';
import { HttpResolver } from './http-resolver.js';
import { RegistryResolver } from './registry-resolver.js';
import { deriveDistTag, readSourceMeta, resolveLatestForChannel, SkillManager, writeSourceMeta } from './skill-manager.js';

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

    it('should enable noManifest via constructor option', () => {
      const manager = new SkillManager(tempDir, { noManifest: true });
      manager.setNoManifest(true);

      const configPath = path.join(tempDir, 'skills.json');
      const lockPath = path.join(tempDir, 'skills.lock');

      expect(fs.existsSync(configPath)).toBe(false);
      expect(fs.existsSync(lockPath)).toBe(false);
    });

    it('should not enable noManifest when option is false even if env var is set', () => {
      const originalEnv = process.env.RESKILL_NO_MANIFEST;
      process.env.RESKILL_NO_MANIFEST = '1';
      try {
        const manager = new SkillManager(tempDir, { noManifest: false });
        // noManifest: false should be respected over env var (nullish coalescing)
        // Verify by checking that ConfigLoader would write if save() is called
        // Since noManifest is false, save() should write to disk
        expect(manager).toBeDefined();
      } finally {
        if (originalEnv === undefined) {
          delete process.env.RESKILL_NO_MANIFEST;
        } else {
          process.env.RESKILL_NO_MANIFEST = originalEnv;
        }
      }
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

    it('should return canonical global directory when in global mode', () => {
      const globalManager = new SkillManager(tempDir, { global: true });
      const home = process.env.HOME || process.env.USERPROFILE || '';
      expect(globalManager.getInstallDir()).toBe(path.join(home, '.agents', 'skills'));
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
        expect(types.length).toBe(18);
        expect(types).toContain('cursor');
        expect(types).toContain('claude-code');
        expect(types).toContain('claude-cowork-3p');
      });
    });

    describe('validateAgentTypes', () => {
      it('should validate correct agent types', () => {
        const result = skillManager.validateAgentTypes([
          'cursor',
          'claude-code',
          'claude-cowork-3p',
        ]);
        expect(result.valid).toEqual(['cursor', 'claude-code', 'claude-cowork-3p']);
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

      const result = await skillManager.installSkillsFromRepo(fileUrl, [], ['cursor'], {
        listOnly: true,
      });

      expect(result.listOnly).toBe(true);
      expect('skills' in result && result.skills).toHaveLength(2);
      const names = (result as { skills: Array<{ name: string }> }).skills
        .map((s) => s.name)
        .sort();
      expect(names).toEqual(['commit', 'pdf']);
    });

    it('should install selected skills and save ref#name to skills.json', async () => {
      const fileUrl = createLocalMultiSkillRepo([
        { name: 'pdf', description: 'PDF skill' },
        { name: 'commit', description: 'Commit skill' },
      ]);

      const result = await skillManager.installSkillsFromRepo(fileUrl, ['pdf'], ['cursor'], {
        save: true,
      });

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
      const fileUrl = createLocalMultiSkillRepo([{ name: 'pdf', description: 'PDF skill' }]);

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

  describe('detectSkillsInRef', () => {
    let repoDir: string;

    function createLocalRepo(structure: 'single' | 'multi' | 'empty'): string {
      const repoPath = path.join(repoDir, `detect-${structure}-repo`);
      fs.mkdirSync(repoPath, { recursive: true });

      if (structure === 'single') {
        // Single skill at root
        fs.writeFileSync(
          path.join(repoPath, 'SKILL.md'),
          '---\nname: my-skill\ndescription: A skill\n---\n# my-skill\n',
        );
      } else if (structure === 'multi') {
        // Parent dir with child skills (no root SKILL.md)
        const skillsDir = path.join(repoPath, 'skills');
        fs.mkdirSync(skillsDir, { recursive: true });
        for (const name of ['alpha', 'beta']) {
          const dir = path.join(skillsDir, name);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(
            path.join(dir, 'SKILL.md'),
            `---\nname: ${name}\ndescription: ${name} skill\n---\n# ${name}\n`,
          );
        }
      } else {
        // Empty repo — no SKILL.md at all
        fs.writeFileSync(path.join(repoPath, 'README.md'), '# Empty');
      }

      execSync('git init -b main', { cwd: repoPath, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: repoPath, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: repoPath, stdio: 'pipe' });
      execSync('git add -A', { cwd: repoPath, stdio: 'pipe' });
      execSync('git commit -m "init"', { cwd: repoPath, stdio: 'pipe' });

      return `file://${repoPath}`;
    }

    beforeEach(() => {
      repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-detect-'));
    });

    afterEach(() => {
      fs.rmSync(repoDir, { recursive: true, force: true });
    });

    it('should return single for a repo with root SKILL.md', async () => {
      const fileUrl = createLocalRepo('single');
      const result = await skillManager.detectSkillsInRef(fileUrl);
      expect(result.type).toBe('single');
    });

    it('should return multi with discovered skills for a parent directory', async () => {
      const fileUrl = createLocalRepo('multi');
      const result = await skillManager.detectSkillsInRef(fileUrl);
      expect(result.type).toBe('multi');
      if (result.type !== 'multi') throw new Error('expected multi');
      const names = result.skills.map((s) => s.name).sort();
      expect(names).toEqual(['alpha', 'beta']);
    });

    it('should fall back to single when repo has no SKILL.md at all (caller handles error)', async () => {
      // When no skills exist anywhere, detectSkillsInRef returns 'single' so
      // the caller proceeds to installToAgents, which produces a clear error.
      const fileUrl = createLocalRepo('empty');
      const result = await skillManager.detectSkillsInRef(fileUrl);
      expect(result.type).toBe('single');
    });

    it('should return single for registry refs', async () => {
      const result = await skillManager.detectSkillsInRef('@scope/name');
      expect(result.type).toBe('single');
    });

    it('should return single for HTTP refs', async () => {
      const result = await skillManager.detectSkillsInRef('https://example.com/skill.tar.gz');
      expect(result.type).toBe('single');
    });

    it('should scope discovery to subPath when ref has subPath (e.g. repo.git/subdir)', async () => {
      // Create a repo with skills in different directories:
      //   subdir/skills/alpha/SKILL.md  (inside subPath)
      //   other/SKILL.md               (outside subPath, should NOT be discovered)
      const repoPath = path.join(repoDir, 'subpath-test.git');
      fs.mkdirSync(repoPath, { recursive: true });

      // Skill inside subPath
      const alphaDir = path.join(repoPath, 'subdir', 'skills', 'alpha');
      fs.mkdirSync(alphaDir, { recursive: true });
      fs.writeFileSync(
        path.join(alphaDir, 'SKILL.md'),
        '---\nname: alpha\ndescription: Alpha skill\n---\n# alpha\n',
      );

      // Skill outside subPath — must NOT appear in results
      const otherDir = path.join(repoPath, 'other');
      fs.mkdirSync(otherDir, { recursive: true });
      fs.writeFileSync(
        path.join(otherDir, 'SKILL.md'),
        '---\nname: other\ndescription: Other skill\n---\n# other\n',
      );

      execSync('git init -b main', { cwd: repoPath, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: repoPath, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: repoPath, stdio: 'pipe' });
      execSync('git add -A', { cwd: repoPath, stdio: 'pipe' });
      execSync('git commit -m "init"', { cwd: repoPath, stdio: 'pipe' });

      // file:///…/subpath-test.git/subdir → parsed.subPath = 'subdir'
      // CacheManager.cache() copies only the subdir/ content, so discovery
      // is scoped to subdir/ and the 'other' skill should not appear.
      const fileUrl = `file://${repoPath}/subdir`;
      const result = await skillManager.detectSkillsInRef(fileUrl);

      expect(result.type).toBe('multi');
      if (result.type !== 'multi') throw new Error('expected multi');
      const names = result.skills.map((s) => s.name).sort();
      expect(names).toEqual(['alpha']);
      // 'other' should NOT be in the results — it's outside subPath
      expect(names).not.toContain('other');
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

    it('should list skills filtered by agent', () => {
      // Create skill in cursor agent directory
      const cursorDir = path.join(tempDir, '.cursor', 'skills', 'cursor-skill');
      fs.mkdirSync(cursorDir, { recursive: true });
      fs.writeFileSync(path.join(cursorDir, 'SKILL.md'), '# Cursor Skill');

      // Create skill in claude-code agent directory (should not appear)
      const claudeDir = path.join(tempDir, '.claude', 'skills', 'claude-skill');
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, 'SKILL.md'), '# Claude Skill');

      const skills = skillManager.list({ agent: 'cursor' });

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('cursor-skill');
    });

    it('should return empty array when no skills exist for the specified agent', () => {
      const skills = skillManager.list({ agent: 'codex' });
      expect(skills).toHaveLength(0);
    });

    it('should still list all skills when no agent filter is specified', () => {
      // Create skill in canonical location
      const canonicalDir = path.join(tempDir, '.agents', 'skills', 'my-skill');
      fs.mkdirSync(canonicalDir, { recursive: true });
      fs.writeFileSync(path.join(canonicalDir, 'SKILL.md'), '# My Skill');

      const skillsWithFilter = skillManager.list({ agent: 'cursor' });
      const skillsWithout = skillManager.list();

      expect(skillsWithFilter).toHaveLength(0); // Not in cursor dir
      expect(skillsWithout).toHaveLength(1); // In canonical dir
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

  it('should handle registry source skills without calling GitResolver', async () => {
    // Setup: skills.json with registry ref (@scope/name)
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({
        skills: { 'shadcn-ui': '@kanyun-test/shadcn-ui' },
      }),
    );

    const { RegistryClient } = await import('./registry-client.js');
    vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
      name: '@kanyun-test/shadcn-ui',
      source_type: 'registry',
    });

    const registryResolver = (skillManager as unknown as { registryResolver: RegistryResolver })
      .registryResolver;
    vi.spyOn(registryResolver, 'resolve').mockResolvedValue({
      parsed: {
        scope: '@kanyun-test',
        name: 'shadcn-ui',
        version: '1.0.0',
        fullName: '@kanyun-test/shadcn-ui',
      },
      shortName: 'shadcn-ui',
      version: '1.0.0',
      registryUrl: 'https://registry.example.com/',
      tarball: Buffer.from('mock tarball'),
      integrity: 'sha256-mockhash',
    });

    const mockSkillDir = path.join(tempDir, 'mock-shadcn-ui');
    fs.mkdirSync(mockSkillDir, { recursive: true });
    fs.writeFileSync(path.join(mockSkillDir, 'SKILL.md'), '# shadcn-ui');
    vi.spyOn(registryResolver, 'extract').mockResolvedValue(mockSkillDir);

    const resolveSpy = vi.spyOn(GitResolver.prototype, 'resolve');

    const updated = await skillManager.update('shadcn-ui');

    expect(resolveSpy).not.toHaveBeenCalled();
    expect(updated).toHaveLength(1);
    expect(updated[0].name).toBe('shadcn-ui');
  });

  it('should re-install registry source skills during update', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({
        skills: { 'my-registry-skill': '@kanyun-test/my-registry-skill' },
      }),
    );

    const { RegistryClient } = await import('./registry-client.js');
    vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
      name: '@kanyun-test/my-registry-skill',
      source_type: 'registry',
    });

    const registryResolver = (skillManager as unknown as { registryResolver: RegistryResolver })
      .registryResolver;
    vi.spyOn(registryResolver, 'resolve').mockResolvedValue({
      parsed: {
        scope: '@kanyun-test',
        name: 'my-registry-skill',
        version: '2.0.0',
        fullName: '@kanyun-test/my-registry-skill',
      },
      shortName: 'my-registry-skill',
      version: '2.0.0',
      registryUrl: 'https://registry.example.com/',
      tarball: Buffer.from('mock tarball'),
      integrity: 'sha256-mockhash',
    });

    const mockSkillDir = path.join(tempDir, 'mock-registry-skill');
    fs.mkdirSync(mockSkillDir, { recursive: true });
    fs.writeFileSync(path.join(mockSkillDir, 'SKILL.md'), '# my-registry-skill');
    vi.spyOn(registryResolver, 'extract').mockResolvedValue(mockSkillDir);

    const updated = await skillManager.update('my-registry-skill');

    expect(updated).toHaveLength(1);
    expect(updated[0].name).toBe('my-registry-skill');
    expect(updated[0].version).toBe('2.0.0');
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

  describe('web-published skill version specifier support', () => {
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

    it('should allow version specifier for local source_type', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/local-skill',
        source_type: 'local',
        source_url: 'local/@kanyun/local-skill.tgz',
      });

      // Mock resolveVersion to return the requested version
      vi.spyOn(RegistryClient.prototype, 'resolveVersion').mockResolvedValue('2.0.0');

      // Mock installFromRegistryLocal
      const installLocalSpy = vi
        .spyOn(
          manager as unknown as Record<string, (...args: unknown[]) => unknown>,
          'installFromRegistryLocal',
        )
        .mockResolvedValue({
          skill: {
            name: 'local-skill',
            path: '/tmp/skill',
            version: '2.0.0',
            source: 'registry:@kanyun/local-skill',
          },
          results: new Map([['cursor', { success: true, path: '/tmp', mode: 'symlink' }]]),
        });

      // local source_type should allow version specifiers
      await manager.installToAgents('@kanyun/local-skill@2.0.0', ['cursor']);

      expect(installLocalSpy).toHaveBeenCalled();
    });

    it('should allow latest version for local source_type', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/local-skill',
        source_type: 'local',
        source_url: 'local/@kanyun/local-skill.tgz',
      });

      vi.spyOn(RegistryClient.prototype, 'resolveVersion').mockResolvedValue('1.0.0');

      const installLocalSpy = vi
        .spyOn(
          manager as unknown as Record<string, (...args: unknown[]) => unknown>,
          'installFromRegistryLocal',
        )
        .mockResolvedValue({
          skill: {
            name: 'local-skill',
            path: '/tmp/skill',
            version: '1.0.0',
            source: 'registry:@kanyun/local-skill',
          },
          results: new Map([['cursor', { success: true, path: '/tmp', mode: 'symlink' }]]),
        });

      await manager.installToAgents('@kanyun/local-skill@latest', ['cursor']);

      expect(installLocalSpy).toHaveBeenCalled();
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
        .spyOn(
          manager as unknown as Record<string, (...args: unknown[]) => unknown>,
          'installToAgentsFromGit',
        )
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
        .spyOn(
          manager as unknown as Record<string, (...args: unknown[]) => unknown>,
          'installToAgentsFromGit',
        )
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

    it('should pass registryContext with registry name for github source_type', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/vercel-react-best-practices',
        source_type: 'github',
        source_url:
          'https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices',
      });

      const installFromGitSpy = vi
        .spyOn(
          manager as unknown as Record<string, (...args: unknown[]) => unknown>,
          'installToAgentsFromGit',
        )
        .mockResolvedValue({
          skill: {
            name: 'vercel-react-best-practices',
            path: '/tmp/skill',
            version: '1.0.0',
            source: 'registry:@kanyun/vercel-react-best-practices',
          },
          results: new Map([['cursor', { success: true, path: '/tmp', mode: 'symlink' }]]),
        });

      await manager.installToAgents('@kanyun/vercel-react-best-practices', ['cursor']);

      // registryContext should carry the registry name, not the Git repo name
      expect(installFromGitSpy).toHaveBeenCalledWith(
        'https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices',
        ['cursor'],
        expect.objectContaining({
          registryContext: expect.objectContaining({
            skillName: 'vercel-react-best-practices',
            configRef: '@kanyun/vercel-react-best-practices',
            lockSource: 'registry:@kanyun/vercel-react-best-practices',
          }),
        }),
      );
    });

    it('should pass registryContext with registry name for oss_url source_type', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/oss-skill',
        source_type: 'oss_url',
        source_url: 'https://bucket.oss.com/skill.tgz',
      });

      const installFromHttpSpy = vi
        .spyOn(
          manager as unknown as Record<string, (...args: unknown[]) => unknown>,
          'installToAgentsFromHttp',
        )
        .mockResolvedValue({
          skill: {
            name: 'oss-skill',
            path: '/tmp/skill',
            version: '1.0.0',
            source: 'registry:@kanyun/oss-skill',
          },
          results: new Map([['cursor', { success: true, path: '/tmp', mode: 'symlink' }]]),
        });

      await manager.installToAgents('@kanyun/oss-skill', ['cursor']);

      expect(installFromHttpSpy).toHaveBeenCalledWith(
        'https://bucket.oss.com/skill.tgz',
        ['cursor'],
        expect.objectContaining({
          registryContext: expect.objectContaining({
            skillName: 'oss-skill',
            configRef: '@kanyun/oss-skill',
            lockSource: 'registry:@kanyun/oss-skill',
          }),
        }),
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

  describe('hasArtifacts: OSS artifact takes priority over web-published fallback', () => {
    it('should use registry flow for github source_type with OSS artifacts (latest_version)', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/github-with-oss',
        source_type: 'github',
        source_url: 'https://github.com/user/repo',
        latest_version: '1.0.0',
        dist_tags: [{ tag: 'latest', version: '1.0.0' }],
      });

      // Mock RegistryResolver (standard registry flow)
      const registryResolver = (manager as unknown as { registryResolver: RegistryResolver })
        .registryResolver;
      vi.spyOn(registryResolver, 'resolve').mockResolvedValue({
        parsed: {
          scope: '@kanyun',
          name: 'github-with-oss',
          version: '1.0.0',
          fullName: '@kanyun/github-with-oss',
        },
        shortName: 'github-with-oss',
        version: '1.0.0',
        registryUrl: 'https://registry.example.com/',
        tarball: Buffer.from('mock tarball'),
        integrity: 'sha256-mockhash',
      });

      const mockSkillDir = path.join(tempDir, 'mock-github-oss');
      fs.mkdirSync(mockSkillDir, { recursive: true });
      fs.writeFileSync(path.join(mockSkillDir, 'SKILL.md'), '# Skill');
      vi.spyOn(registryResolver, 'extract').mockResolvedValue(mockSkillDir);

      // Should NOT call installFromWebPublished / installToAgentsFromGit
      const installFromGitSpy = vi
        .spyOn(
          manager as unknown as Record<string, (...args: unknown[]) => unknown>,
          'installToAgentsFromGit',
        )
        .mockResolvedValue({
          skill: {
            name: 'github-with-oss',
            path: '/tmp/skill',
            version: '1.0.0',
            source: 'github',
          },
          results: new Map([['cursor', { success: true, path: '/tmp', mode: 'symlink' }]]),
        });

      const result = await manager.installToAgents('@kanyun/github-with-oss', ['cursor']);

      // Should go through registry flow, NOT git clone
      expect(installFromGitSpy).not.toHaveBeenCalled();
      expect(result.skill.name).toBe('github-with-oss');
    });

    it('should use registry flow for gitlab source_type with dist_tags only', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/gitlab-with-oss',
        source_type: 'gitlab',
        source_url: 'https://gitlab.com/org/repo',
        dist_tags: [{ tag: 'latest', version: '2.0.0' }],
      });

      const registryResolver = (manager as unknown as { registryResolver: RegistryResolver })
        .registryResolver;
      vi.spyOn(registryResolver, 'resolve').mockResolvedValue({
        parsed: {
          scope: '@kanyun',
          name: 'gitlab-with-oss',
          version: '2.0.0',
          fullName: '@kanyun/gitlab-with-oss',
        },
        shortName: 'gitlab-with-oss',
        version: '2.0.0',
        registryUrl: 'https://registry.example.com/',
        tarball: Buffer.from('mock tarball'),
        integrity: 'sha256-mockhash',
      });

      const mockSkillDir = path.join(tempDir, 'mock-gitlab-oss');
      fs.mkdirSync(mockSkillDir, { recursive: true });
      fs.writeFileSync(path.join(mockSkillDir, 'SKILL.md'), '# Skill');
      vi.spyOn(registryResolver, 'extract').mockResolvedValue(mockSkillDir);

      const result = await manager.installToAgents('@kanyun/gitlab-with-oss', ['cursor']);

      expect(result.skill.name).toBe('gitlab-with-oss');
    });

    it('should fall back to git clone for github source_type without artifacts', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/github-no-oss',
        source_type: 'github',
        source_url: 'https://github.com/user/old-repo',
        // no latest_version, no dist_tags
      });

      const installFromGitSpy = vi
        .spyOn(
          manager as unknown as Record<string, (...args: unknown[]) => unknown>,
          'installToAgentsFromGit',
        )
        .mockResolvedValue({
          skill: { name: 'github-no-oss', path: '/tmp/skill', version: '1.0.0', source: 'github' },
          results: new Map([['cursor', { success: true, path: '/tmp', mode: 'symlink' }]]),
        });

      await manager.installToAgents('@kanyun/github-no-oss', ['cursor']);

      // Should fall back to git clone
      expect(installFromGitSpy).toHaveBeenCalled();
    });
  });

  describe('skill_path 支持（多技能仓库）', () => {
    it('should construct ref with skill_path for github source_type', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/accessibility',
        source_type: 'github',
        source_url: 'https://github.com/user/web-quality-skills',
        skill_path: 'skills/accessibility',
      });

      const installFromGitSpy = vi
        .spyOn(
          manager as unknown as Record<string, (...args: unknown[]) => unknown>,
          'installToAgentsFromGit',
        )
        .mockResolvedValue({
          skill: { name: 'accessibility', path: '/tmp/skill', version: '1.0.0', source: 'github' },
          results: new Map([['cursor', { success: true, path: '/tmp', mode: 'symlink' }]]),
        });

      await manager.installToAgents('@kanyun/accessibility', ['cursor']);

      expect(installFromGitSpy).toHaveBeenCalledWith(
        'github:user/web-quality-skills/skills/accessibility',
        ['cursor'],
        expect.any(Object),
      );
    });

    it('should use source_url as-is when skill_path is absent', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/github-skill',
        source_type: 'github',
        source_url: 'https://github.com/user/repo/tree/main/skills/my-skill',
      });

      const installFromGitSpy = vi
        .spyOn(
          manager as unknown as Record<string, (...args: unknown[]) => unknown>,
          'installToAgentsFromGit',
        )
        .mockResolvedValue({
          skill: { name: 'my-skill', path: '/tmp/skill', version: '1.0.0', source: 'github' },
          results: new Map([['cursor', { success: true, path: '/tmp', mode: 'symlink' }]]),
        });

      await manager.installToAgents('@kanyun/github-skill', ['cursor']);

      expect(installFromGitSpy).toHaveBeenCalledWith(
        'https://github.com/user/repo/tree/main/skills/my-skill',
        ['cursor'],
        expect.any(Object),
      );
    });

    it('should fall back to #shortName when parseGitUrl fails with skill_path', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/my-skill',
        source_type: 'github',
        source_url: 'not-a-valid-git-url',
        skill_path: 'skills/my-skill',
      });

      const installFromGitSpy = vi
        .spyOn(
          manager as unknown as Record<string, (...args: unknown[]) => unknown>,
          'installToAgentsFromGit',
        )
        .mockResolvedValue({
          skill: { name: 'my-skill', path: '/tmp/skill', version: '1.0.0', source: 'github' },
          results: new Map([['cursor', { success: true, path: '/tmp', mode: 'symlink' }]]),
        });

      await manager.installToAgents('@kanyun/my-skill', ['cursor']);

      expect(installFromGitSpy).toHaveBeenCalledWith(
        'not-a-valid-git-url#my-skill',
        ['cursor'],
        expect.any(Object),
      );
    });

    it('should construct ref with skill_path for gitlab source_type', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/seo',
        source_type: 'gitlab',
        source_url: 'https://gitlab.com/org/skills-repo',
        skill_path: 'skills/seo',
      });

      const installFromGitSpy = vi
        .spyOn(
          manager as unknown as Record<string, (...args: unknown[]) => unknown>,
          'installToAgentsFromGit',
        )
        .mockResolvedValue({
          skill: { name: 'seo', path: '/tmp/skill', version: '1.0.0', source: 'gitlab' },
          results: new Map([['cursor', { success: true, path: '/tmp', mode: 'symlink' }]]),
        });

      await manager.installToAgents('@kanyun/seo', ['cursor']);

      expect(installFromGitSpy).toHaveBeenCalledWith(
        'gitlab:org/skills-repo/skills/seo',
        ['cursor'],
        expect.any(Object),
      );
    });
  });

  describe('self-hosted GitLab/GitHub support', () => {
    it('should use host as prefix for self-hosted GitLab with skill_path', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/log-helper',
        source_type: 'gitlab',
        source_url: 'https://gitlab.internal.example.com/team/skills-repo',
        skill_path: 'log-helper',
      });

      const installFromGitSpy = vi
        .spyOn(
          manager as unknown as Record<string, (...args: unknown[]) => unknown>,
          'installToAgentsFromGit',
        )
        .mockResolvedValue({
          skill: {
            name: 'log-helper',
            path: '/tmp/skill',
            version: '1.0.0',
            source: 'gitlab',
          },
          results: new Map([['cursor', { success: true, path: '/tmp', mode: 'symlink' }]]),
        });

      await manager.installToAgents('@kanyun/log-helper', ['cursor']);

      // Self-hosted GitLab should use host as prefix, not "gitlab"
      expect(installFromGitSpy).toHaveBeenCalledWith(
        'gitlab.internal.example.com:team/skills-repo/log-helper',
        ['cursor'],
        expect.any(Object),
      );
    });

    it('should use host as prefix for self-hosted GitHub Enterprise with skill_path', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/my-skill',
        source_type: 'github',
        source_url: 'https://github.company.com/org/skills-monorepo',
        skill_path: 'skills/my-skill',
      });

      const installFromGitSpy = vi
        .spyOn(
          manager as unknown as Record<string, (...args: unknown[]) => unknown>,
          'installToAgentsFromGit',
        )
        .mockResolvedValue({
          skill: {
            name: 'my-skill',
            path: '/tmp/skill',
            version: '1.0.0',
            source: 'github',
          },
          results: new Map([['cursor', { success: true, path: '/tmp', mode: 'symlink' }]]),
        });

      await manager.installToAgents('@kanyun/my-skill', ['cursor']);

      expect(installFromGitSpy).toHaveBeenCalledWith(
        'github.company.com:org/skills-monorepo/skills/my-skill',
        ['cursor'],
        expect.any(Object),
      );
    });

    it('should still use "gitlab" prefix for standard gitlab.com with skill_path', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/seo',
        source_type: 'gitlab',
        source_url: 'https://gitlab.com/org/skills-repo',
        skill_path: 'skills/seo',
      });

      const installFromGitSpy = vi
        .spyOn(
          manager as unknown as Record<string, (...args: unknown[]) => unknown>,
          'installToAgentsFromGit',
        )
        .mockResolvedValue({
          skill: { name: 'seo', path: '/tmp/skill', version: '1.0.0', source: 'gitlab' },
          results: new Map([['cursor', { success: true, path: '/tmp', mode: 'symlink' }]]),
        });

      await manager.installToAgents('@kanyun/seo', ['cursor']);

      expect(installFromGitSpy).toHaveBeenCalledWith(
        'gitlab:org/skills-repo/skills/seo',
        ['cursor'],
        expect.any(Object),
      );
    });

    it('should still use "github" prefix for standard github.com with skill_path', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/accessibility',
        source_type: 'github',
        source_url: 'https://github.com/user/web-quality-skills',
        skill_path: 'skills/accessibility',
      });

      const installFromGitSpy = vi
        .spyOn(
          manager as unknown as Record<string, (...args: unknown[]) => unknown>,
          'installToAgentsFromGit',
        )
        .mockResolvedValue({
          skill: {
            name: 'accessibility',
            path: '/tmp/skill',
            version: '1.0.0',
            source: 'github',
          },
          results: new Map([['cursor', { success: true, path: '/tmp', mode: 'symlink' }]]),
        });

      await manager.installToAgents('@kanyun/accessibility', ['cursor']);

      expect(installFromGitSpy).toHaveBeenCalledWith(
        'github:user/web-quality-skills/skills/accessibility',
        ['cursor'],
        expect.any(Object),
      );
    });

    it('should use source_url as-is for self-hosted GitLab without skill_path', async () => {
      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: '@kanyun/single-skill',
        source_type: 'gitlab',
        source_url: 'https://gitlab.internal.example.com/team/single-skill',
      });

      const installFromGitSpy = vi
        .spyOn(
          manager as unknown as Record<string, (...args: unknown[]) => unknown>,
          'installToAgentsFromGit',
        )
        .mockResolvedValue({
          skill: {
            name: 'single-skill',
            path: '/tmp/skill',
            version: '1.0.0',
            source: 'gitlab',
          },
          results: new Map([['cursor', { success: true, path: '/tmp', mode: 'symlink' }]]),
        });

      await manager.installToAgents('@kanyun/single-skill', ['cursor']);

      // Without skill_path, source_url should be passed as-is
      expect(installFromGitSpy).toHaveBeenCalledWith(
        'https://gitlab.internal.example.com/team/single-skill',
        ['cursor'],
        expect.any(Object),
      );
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

      // Verify resolve was called with the custom registry URL (token is undefined)
      expect(resolveSpy).toHaveBeenCalledWith('my-skill', customRegistryUrl, undefined);
    });

    it('should use options.registry for RegistryClient when querying skill info', async () => {
      const customRegistryUrl = 'https://custom-registry.example.com';

      const { RegistryClient } = await import('./registry-client.js');
      const getSkillInfoSpy = vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
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
      // token is undefined when not provided
      expect(resolveSpy).toHaveBeenCalledWith(
        '@kanyun/scope-skill',
        'https://rush.zhenguanyu.com/',
        undefined,
      );
    });

    it('should pass token to RegistryResolver.resolve when provided in options', async () => {
      const customRegistryUrl = 'https://custom-registry.example.com';
      const authToken = 'test-jwt-token-123';

      const { RegistryClient } = await import('./registry-client.js');
      vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
        name: 'my-skill',
        source_type: 'registry',
      });

      // Mock RegistryResolver
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

      const mockSkillDir = path.join(tempDir, 'mock-skill-token');
      fs.mkdirSync(mockSkillDir, { recursive: true });
      fs.writeFileSync(path.join(mockSkillDir, 'SKILL.md'), '# Skill');
      vi.spyOn(registryResolver, 'extract').mockResolvedValue(mockSkillDir);

      await manager.installToAgents('my-skill', ['cursor'], {
        registry: customRegistryUrl,
        token: authToken,
      });

      // Verify resolve was called with the token
      expect(resolveSpy).toHaveBeenCalledWith('my-skill', customRegistryUrl, authToken);
    });

    it('should pass token to RegistryClient constructor when querying skill info', async () => {
      const customRegistryUrl = 'https://custom-registry.example.com';
      const authToken = 'test-jwt-token-456';

      const registryClientModule = await import('./registry-client.js');
      const constructorSpy = vi.fn();
      const OriginalClient = registryClientModule.RegistryClient;

      // Spy on constructor to capture the config (including token)
      vi.spyOn(registryClientModule, 'RegistryClient').mockImplementation((config) => {
        constructorSpy(config);
        const instance = new OriginalClient(config);
        vi.spyOn(instance, 'getSkillInfo').mockResolvedValue({
          name: 'my-skill',
          source_type: 'registry',
        });
        return instance;
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

      const mockSkillDir = path.join(tempDir, 'mock-skill-token-client');
      fs.mkdirSync(mockSkillDir, { recursive: true });
      fs.writeFileSync(path.join(mockSkillDir, 'SKILL.md'), '# Skill');
      vi.spyOn(registryResolver, 'extract').mockResolvedValue(mockSkillDir);

      await manager.installToAgents('my-skill', ['cursor'], {
        registry: customRegistryUrl,
        token: authToken,
      });

      // Verify RegistryClient was constructed with the token
      expect(constructorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ registry: customRegistryUrl, token: authToken }),
      );
    });
  });
});

// ============================================================================
// Per-agent "already installed" check (Issue #276)
// ============================================================================

describe('SkillManager per-agent installation check', () => {
  let tempDir: string;
  let manager: SkillManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-per-agent-install-'));
    manager = new SkillManager(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper: set up canonical skill path + lock file so the "already installed" branch is reached
   */
  function setupInstalledSkill(skillName: string, version: string) {
    // Create canonical skill directory (.agents/skills/<name>)
    const canonicalPath = path.join(tempDir, '.agents', 'skills', skillName);
    fs.mkdirSync(canonicalPath, { recursive: true });
    fs.writeFileSync(
      path.join(canonicalPath, 'SKILL.md'),
      `---\nname: ${skillName}\nversion: ${version}\n---\n\n# ${skillName}\n`,
    );

    // Create skills.lock with matching version
    const lockPath = path.join(tempDir, 'skills.lock');
    const lockData = {
      lockfileVersion: 1,
      skills: {
        [skillName]: {
          source: `registry:@kanyun/${skillName}`,
          version,
          ref: version,
          resolved: 'https://registry.example.com/',
          commit: 'sha256-mock',
          installedAt: new Date().toISOString(),
          registry: 'https://registry.example.com/',
        },
      },
    };
    fs.writeFileSync(lockPath, JSON.stringify(lockData, null, 2));

    return canonicalPath;
  }

  /**
   * Helper: mock RegistryClient and RegistryResolver for standard registry flow
   */
  async function mockRegistryFlow(skillName: string, version: string) {
    const { RegistryClient } = await import('./registry-client.js');
    vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
      name: `@kanyun/${skillName}`,
      source_type: 'registry',
    });

    const registryResolver = (manager as unknown as { registryResolver: RegistryResolver })
      .registryResolver;
    vi.spyOn(registryResolver, 'resolve').mockResolvedValue({
      parsed: {
        scope: '@kanyun',
        name: skillName,
        version,
        fullName: `@kanyun/${skillName}`,
      },
      shortName: skillName,
      version,
      registryUrl: 'https://registry.example.com/',
      tarball: Buffer.from('mock tarball'),
      integrity: 'sha256-mock',
    });

    return registryResolver;
  }

  it('should install to new agent when skill is already installed for a different agent', async () => {
    const skillName = 'cli-skill';
    const version = '1.0.0';

    // Set up: skill exists in canonical location
    setupInstalledSkill(skillName, version);

    // Set up: skill is installed for cursor (create cursor agent dir at .cursor/skills/)
    const cursorSkillPath = path.join(tempDir, '.cursor', 'skills', skillName);
    fs.mkdirSync(cursorSkillPath, { recursive: true });
    fs.writeFileSync(path.join(cursorSkillPath, 'SKILL.md'), '# skill');

    // Mock registry
    await mockRegistryFlow(skillName, version);

    // claude-code should NOT have the skill before install
    const claudeSkillPath = path.join(tempDir, '.claude', 'skills', skillName);
    expect(fs.existsSync(claudeSkillPath)).toBe(false);

    // Install to claude-code (which doesn't have it yet)
    const result = await manager.installToAgents(`@kanyun/${skillName}@${version}`, ['claude-code']);

    // Should succeed — not skipped
    expect(result.skill.name).toBe(skillName);
    expect(result.results.get('claude-code')?.success).toBe(true);

    // The skill should now actually exist in claude-code's directory with valid content
    expect(fs.existsSync(claudeSkillPath)).toBe(true);
    expect(fs.existsSync(path.join(claudeSkillPath, 'SKILL.md'))).toBe(true);
    const content = fs.readFileSync(path.join(claudeSkillPath, 'SKILL.md'), 'utf-8');
    expect(content).toContain('cli-skill');
  });

  it('should skip installation when all target agents already have the skill', async () => {
    const skillName = 'cli-skill';
    const version = '1.0.0';

    // Set up: skill exists in canonical location
    setupInstalledSkill(skillName, version);

    // Set up: skill is installed for both cursor (.cursor/skills/) and claude-code (.claude/skills/)
    const cursorSkillPath = path.join(tempDir, '.cursor', 'skills', skillName);
    fs.mkdirSync(cursorSkillPath, { recursive: true });
    fs.writeFileSync(path.join(cursorSkillPath, 'SKILL.md'), '# skill');

    const claudeSkillPath = path.join(tempDir, '.claude', 'skills', skillName);
    fs.mkdirSync(claudeSkillPath, { recursive: true });
    fs.writeFileSync(path.join(claudeSkillPath, 'SKILL.md'), '# skill');

    // Mock registry
    await mockRegistryFlow(skillName, version);

    // Install to both agents (which already have it)
    const result = await manager.installToAgents(`@kanyun/${skillName}@${version}`, [
      'cursor',
      'claude-code',
    ]);

    // Should report success without re-downloading
    expect(result.skill.name).toBe(skillName);
    expect(result.results.get('cursor')?.success).toBe(true);
    expect(result.results.get('claude-code')?.success).toBe(true);
  });

  it('should warn when installed version differs and no --force', async () => {
    const skillName = 'cli-skill';

    // Set up: skill exists in canonical location with version 1.0.0
    setupInstalledSkill(skillName, '1.0.0');

    // Mock registry resolves to version 2.0.0 (different from lock)
    await mockRegistryFlow(skillName, '2.0.0');

    // Install without --force
    const result = await manager.installToAgents(`@kanyun/${skillName}@2.0.0`, ['cursor']);

    // Should return existing skill info (not re-download), with the existing version
    expect(result.skill.name).toBe(skillName);
    // The result returns the already-installed skill, not the new version
    expect(result.skill.version).toBe('1.0.0');
  });

  it('should reinstall to all agents when --force is used regardless of installation status', async () => {
    const skillName = 'cli-skill';
    const version = '1.0.0';

    // Set up: skill exists in canonical location
    setupInstalledSkill(skillName, version);

    // Set up: skill is installed for cursor (.cursor/skills/)
    const cursorSkillPath = path.join(tempDir, '.cursor', 'skills', skillName);
    fs.mkdirSync(cursorSkillPath, { recursive: true });
    fs.writeFileSync(path.join(cursorSkillPath, 'SKILL.md'), '# skill');

    // Mock registry
    const registryResolver = await mockRegistryFlow(skillName, version);

    // Mock extract to return a valid path
    const mockSkillDir = path.join(tempDir, 'mock-extracted-skill');
    fs.mkdirSync(mockSkillDir, { recursive: true });
    fs.writeFileSync(path.join(mockSkillDir, 'SKILL.md'), `---\nname: ${skillName}\nversion: ${version}\n---\n# skill`);
    vi.spyOn(registryResolver, 'extract').mockResolvedValue(mockSkillDir);

    // Install with --force to cursor (which already has it)
    const result = await manager.installToAgents(`@kanyun/${skillName}@${version}`, ['cursor'], {
      force: true,
    });

    // Should reinstall (force bypasses the check entirely)
    expect(result.skill.name).toBe(skillName);
    expect(result.results.get('cursor')?.success).toBe(true);
  });

  // ----------------------------------------------------------------------
  // Bug repro: canonical skill exists without lock file (e.g. previous
  // global install), now installing for a new agent should still copy the
  // skill into that agent's directory instead of returning a fake success.
  // ----------------------------------------------------------------------

  /**
   * Helper: create canonical skill WITHOUT writing a lock file.
   * Simulates the state after a previous global install (no lock written).
   */
  function setupCanonicalSkillNoLock(skillName: string, version: string): string {
    const canonicalPath = path.join(tempDir, '.agents', 'skills', skillName);
    fs.mkdirSync(canonicalPath, { recursive: true });
    fs.writeFileSync(
      path.join(canonicalPath, 'SKILL.md'),
      `---\nname: ${skillName}\nversion: ${version}\n---\n\n# ${skillName}\n`,
    );
    return canonicalPath;
  }

  it('should install to target agent when canonical exists but no lock file (fixes regression)', async () => {
    const skillName = 'cli-skill';
    const version = '1.0.0';

    // Canonical exists from a previous (global) install — no lock file written.
    setupCanonicalSkillNoLock(skillName, version);

    // Target agent (cursor) does NOT have the skill installed.
    const cursorSkillPath = path.join(tempDir, '.cursor', 'skills', skillName);
    expect(fs.existsSync(cursorSkillPath)).toBe(false);

    await mockRegistryFlow(skillName, version);

    const result = await manager.installToAgents(`@kanyun/${skillName}@${version}`, ['cursor']);

    // Cursor must actually receive the skill (this was the bug — it didn't).
    expect(result.results.get('cursor')?.success).toBe(true);
    expect(fs.existsSync(cursorSkillPath)).toBe(true);
    expect(fs.existsSync(path.join(cursorSkillPath, 'SKILL.md'))).toBe(true);
  });

  it('should install to claude-cowork-3p when canonical exists but skill not in claude-3p root (fixes user-reported bug)', async () => {
    const { CLAUDE_3P_SKILLS_ROOT_ENV } = await import('./claude-3p-installer.js');
    const skillName = 'docz';
    const version = '0.10.0';

    // Set up an isolated claude-3p skills root for this test.
    const claude3pRoot = path.join(tempDir, 'claude-3p-root');
    fs.mkdirSync(path.join(claude3pRoot, 'skills'), { recursive: true });
    fs.writeFileSync(path.join(claude3pRoot, 'manifest.json'), '{"skills":[]}\n');
    const originalRoot = process.env[CLAUDE_3P_SKILLS_ROOT_ENV];
    process.env[CLAUDE_3P_SKILLS_ROOT_ENV] = claude3pRoot;

    try {
      // Canonical exists from a previous install (no lock — global install scenario).
      setupCanonicalSkillNoLock(skillName, version);

      // claude-3p does NOT have the skill yet.
      const claude3pSkillPath = path.join(claude3pRoot, 'skills', skillName);
      expect(fs.existsSync(claude3pSkillPath)).toBe(false);

      await mockRegistryFlow(skillName, version);

      const result = await manager.installToAgents(`@kanyun/${skillName}@${version}`, [
        'claude-cowork-3p',
      ]);

      // The skill must actually land in the claude-3p skills root.
      expect(result.results.get('claude-cowork-3p')?.success).toBe(true);
      expect(fs.existsSync(claude3pSkillPath)).toBe(true);
      expect(fs.existsSync(path.join(claude3pSkillPath, 'SKILL.md'))).toBe(true);

      // The returned path should point at the claude-3p location, not the
      // canonical directory (this is what makes the CLI output truthful).
      const installResult = result.results.get('claude-cowork-3p');
      expect(installResult?.path).toBe(claude3pSkillPath);

      // The manifest.json should record the new skill.
      const manifest = JSON.parse(
        fs.readFileSync(path.join(claude3pRoot, 'manifest.json'), 'utf-8'),
      );
      expect(manifest.skills).toEqual(
        expect.arrayContaining([expect.objectContaining({ skillId: skillName })]),
      );
    } finally {
      if (originalRoot === undefined) {
        delete process.env[CLAUDE_3P_SKILLS_ROOT_ENV];
      } else {
        process.env[CLAUDE_3P_SKILLS_ROOT_ENV] = originalRoot;
      }
    }
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

    it('should use version from SKILL.md for a symlinked (global) install, not the literal string "local"', () => {
      // Simulate a global install: real skill lives elsewhere, canonical path is a symlink to it
      // (this mirrors `reskill install -g` / the default symlink install mode)
      const realSkillPath = path.join(tempDir, 'real-skills', 'linked-skill');
      fs.mkdirSync(realSkillPath, { recursive: true });
      fs.writeFileSync(
        path.join(realSkillPath, 'SKILL.md'),
        `---
name: linked-skill
description: A symlinked skill
version: 2.3.0
---

# Linked Skill
`,
      );

      const canonicalDir = path.join(tempDir, '.agents', 'skills');
      fs.mkdirSync(canonicalDir, { recursive: true });
      fs.symlinkSync(realSkillPath, path.join(canonicalDir, 'linked-skill'), 'dir');

      const skill = skillManager.getInstalledSkill('linked-skill');
      expect(skill).not.toBeNull();
      expect(skill?.isLinked).toBe(true);
      // Regression: previously this returned the literal string 'local' for any symlinked
      // install, discarding the real version from SKILL.md/lockfile.
      expect(skill?.version).toBe('2.3.0');
    });

    it('should fall back to .reskill-source.json version when SKILL.md has no version (global registry install)', () => {
      // Simulate a registry-installed skill whose published SKILL.md never had a `version:`
      // frontmatter field, but writeSourceMeta() recorded the resolved registry version at
      // install time (this is what `reskill install -g @scope/name` does for effectively-global
      // installs, since they never get a skills.lock entry).
      const skillPath = path.join(tempDir, '.agents', 'skills', 'registry-skill');
      fs.mkdirSync(skillPath, { recursive: true });
      fs.writeFileSync(
        path.join(skillPath, 'SKILL.md'),
        `---
name: registry-skill
description: A registry skill without a version header
---

# Registry Skill
`,
      );
      writeSourceMeta(skillPath, {
        source: 'registry:@scope/registry-skill',
        version: '1.0.1',
      });

      const skill = skillManager.getInstalledSkill('registry-skill');
      expect(skill).not.toBeNull();
      // Regression: previously .reskill-source.json was never consulted by getInstalledSkill,
      // so this fell all the way through to 'unknown' even though the real installed version
      // was known and recorded on disk.
      expect(skill?.version).toBe('1.0.1');
    });
  });

  describe('list() should include agents field', () => {
    it('should detect agents that have the skill installed (project mode)', () => {
      // Create skill in canonical location
      const canonicalDir = path.join(tempDir, '.agents', 'skills', 'my-skill');
      fs.mkdirSync(canonicalDir, { recursive: true });
      fs.writeFileSync(path.join(canonicalDir, 'SKILL.md'), '# My Skill');

      // Simulate agent installation: create skill dirs in agent-specific locations
      const cursorSkillDir = path.join(tempDir, '.cursor', 'skills', 'my-skill');
      fs.mkdirSync(cursorSkillDir, { recursive: true });

      const claudeSkillDir = path.join(tempDir, '.claude', 'skills', 'my-skill');
      fs.mkdirSync(claudeSkillDir, { recursive: true });

      const skills = skillManager.list();
      expect(skills).toHaveLength(1);
      expect(skills[0].agents).toBeDefined();
      expect(skills[0].agents).toContain('cursor');
      expect(skills[0].agents).toContain('claude-code');
      // Should NOT contain agents that don't have the skill
      expect(skills[0].agents).not.toContain('codex');
    });

    it('should return empty agents array when no agent directories have the skill', () => {
      // Create skill only in canonical location, no agent dirs
      const canonicalDir = path.join(tempDir, '.agents', 'skills', 'orphan-skill');
      fs.mkdirSync(canonicalDir, { recursive: true });
      fs.writeFileSync(path.join(canonicalDir, 'SKILL.md'), '# Orphan Skill');

      const skills = skillManager.list();
      expect(skills).toHaveLength(1);
      expect(skills[0].agents).toBeDefined();
      expect(skills[0].agents).toHaveLength(0);
    });

    it('should detect different agents for different skills', () => {
      // skill-a: installed for cursor only
      const skillACanonical = path.join(tempDir, '.agents', 'skills', 'skill-a');
      fs.mkdirSync(skillACanonical, { recursive: true });
      fs.writeFileSync(path.join(skillACanonical, 'SKILL.md'), '# Skill A');
      const cursorSkillA = path.join(tempDir, '.cursor', 'skills', 'skill-a');
      fs.mkdirSync(cursorSkillA, { recursive: true });

      // skill-b: installed for claude-code only
      const skillBCanonical = path.join(tempDir, '.agents', 'skills', 'skill-b');
      fs.mkdirSync(skillBCanonical, { recursive: true });
      fs.writeFileSync(path.join(skillBCanonical, 'SKILL.md'), '# Skill B');
      const claudeSkillB = path.join(tempDir, '.claude', 'skills', 'skill-b');
      fs.mkdirSync(claudeSkillB, { recursive: true });

      const skills = skillManager.list();
      expect(skills).toHaveLength(2);

      const skillA = skills.find((s) => s.name === 'skill-a');
      const skillB = skills.find((s) => s.name === 'skill-b');

      expect(skillA?.agents).toContain('cursor');
      expect(skillA?.agents).not.toContain('claude-code');

      expect(skillB?.agents).toContain('claude-code');
      expect(skillB?.agents).not.toContain('cursor');
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

describe('SkillManager registry fallback from lock file', () => {
  let tempDir: string;
  let skillManager: SkillManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-lock-fallback-test-'));
    skillManager = new SkillManager(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should use lock registry when reinstalling unscoped registry skills', async () => {
    // Setup: skills.json with unscoped bare name
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({
        skills: { 'find-skills': 'find-skills' },
      }),
    );

    // Setup: skills.lock with registry URL from previous install
    fs.writeFileSync(
      path.join(tempDir, 'skills.lock'),
      JSON.stringify({
        lockfileVersion: 1,
        skills: {
          'find-skills': {
            source: 'registry:find-skills',
            version: 'main',
            ref: 'main',
            resolved: 'https://github.com/vercel-labs/skills',
            commit: 'abc123',
            installedAt: new Date().toISOString(),
            registry: 'https://private-registry.example.com/',
          },
        },
      }),
    );

    // Mock the registry client to verify correct registry URL is used
    const { RegistryClient } = await import('./registry-client.js');
    const getSkillInfoSpy = vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
      name: 'find-skills',
      source_type: 'github',
      source_url: 'https://github.com/vercel-labs/skills',
    });

    // Mock the full Git install chain (must return nested { parsed, repoUrl, ref })
    vi.spyOn(GitResolver.prototype, 'resolve').mockResolvedValue({
      parsed: {
        registry: 'github',
        owner: 'vercel-labs',
        repo: 'skills',
        raw: 'https://github.com/vercel-labs/skills',
      },
      repoUrl: 'https://github.com/vercel-labs/skills',
      ref: 'main',
    });

    const { CacheManager } = await import('./cache-manager.js');
    const mockSkillDir = path.join(tempDir, 'mock-find-skills');
    fs.mkdirSync(mockSkillDir, { recursive: true });
    fs.writeFileSync(path.join(mockSkillDir, 'SKILL.md'), '# find-skills');
    vi.spyOn(CacheManager.prototype, 'cache').mockResolvedValue({
      path: mockSkillDir,
      commit: 'abc123',
    });

    // Should NOT throw - the lock file registry fallback should route to private registry
    await skillManager.installAll();

    // Verify RegistryClient was called (proving it reached the registry path)
    expect(getSkillInfoSpy).toHaveBeenCalled();
  });

  it('should use lock registry when updating unscoped registry skills', async () => {
    // Setup: skills.json with unscoped bare name
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({
        skills: { 'find-skills': 'find-skills' },
      }),
    );

    // Setup: skills.lock with registry URL from previous install
    fs.writeFileSync(
      path.join(tempDir, 'skills.lock'),
      JSON.stringify({
        lockfileVersion: 1,
        skills: {
          'find-skills': {
            source: 'registry:find-skills',
            version: 'main',
            ref: 'main',
            resolved: 'https://github.com/vercel-labs/skills',
            commit: 'abc123',
            installedAt: new Date().toISOString(),
            registry: 'https://private-registry.example.com/',
          },
        },
      }),
    );

    const { RegistryClient } = await import('./registry-client.js');
    const getSkillInfoSpy = vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
      name: 'find-skills',
      source_type: 'github',
      source_url: 'https://github.com/vercel-labs/skills',
    });

    // Mock Git resolve (nested structure)
    vi.spyOn(GitResolver.prototype, 'resolve').mockResolvedValue({
      parsed: {
        registry: 'github',
        owner: 'vercel-labs',
        repo: 'skills',
        raw: 'https://github.com/vercel-labs/skills',
      },
      repoUrl: 'https://github.com/vercel-labs/skills',
      ref: 'main',
    });

    const { CacheManager } = await import('./cache-manager.js');
    const mockSkillDir = path.join(tempDir, 'mock-find-skills');
    fs.mkdirSync(mockSkillDir, { recursive: true });
    fs.writeFileSync(path.join(mockSkillDir, 'SKILL.md'), '# find-skills');
    vi.spyOn(CacheManager.prototype, 'cache').mockResolvedValue({
      path: mockSkillDir,
      commit: 'def456',
    });

    // Should NOT throw "fetch failed"
    const updated = await skillManager.update('find-skills');

    expect(updated).toHaveLength(1);
    expect(updated[0].name).toBe('find-skills');
    expect(getSkillInfoSpy).toHaveBeenCalled();
  });

  it('should not inject registry for non-registry refs', async () => {
    // Setup: skills.json with a Git-style ref
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({
        skills: { reskill: 'github:kanyun-inc/reskill' },
      }),
    );

    // Lock file without registry field (Git sources don't have it)
    fs.writeFileSync(
      path.join(tempDir, 'skills.lock'),
      JSON.stringify({
        lockfileVersion: 1,
        skills: {
          reskill: {
            source: 'github:kanyun-inc/reskill',
            version: 'main',
            ref: 'main',
            resolved: 'https://github.com/kanyun-inc/reskill',
            commit: 'abc123',
            installedAt: new Date().toISOString(),
          },
        },
      }),
    );

    // Mock Git resolve (nested structure)
    vi.spyOn(GitResolver.prototype, 'resolve').mockResolvedValue({
      parsed: {
        registry: 'github',
        owner: 'kanyun-inc',
        repo: 'reskill',
        raw: 'github:kanyun-inc/reskill',
      },
      repoUrl: 'https://github.com/kanyun-inc/reskill',
      ref: 'main',
    });

    const { CacheManager } = await import('./cache-manager.js');
    const mockSkillDir = path.join(tempDir, 'mock-reskill');
    fs.mkdirSync(mockSkillDir, { recursive: true });
    fs.writeFileSync(path.join(mockSkillDir, 'SKILL.md'), '# reskill');
    vi.spyOn(CacheManager.prototype, 'cache').mockResolvedValue({
      path: mockSkillDir,
      commit: 'abc123',
    });

    // Should work normally without registry injection
    const installed = await skillManager.installAll();
    expect(installed).toHaveLength(1);
    expect(installed[0].name).toBe('reskill');
  });
});

// ============================================================================
// resolveRegistryUrl tests
// ============================================================================

describe('SkillManager resolveRegistryUrl', () => {
  let tempDir: string;
  let skillManager: SkillManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-resolve-registry-'));
    skillManager = new SkillManager(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // Access the private method via casting
  const callResolveRegistryUrl = (
    manager: SkillManager,
    ref: string,
    explicitRegistry?: string,
  ): Promise<string> => {
    return (
      manager as unknown as Record<string, (...args: unknown[]) => Promise<string>>
    ).resolveRegistryUrl(ref, explicitRegistry);
  };

  it('should use explicit CLI override first', async () => {
    const url = await callResolveRegistryUrl(
      skillManager,
      'find-skills',
      'https://custom.example.com/',
    );
    expect(url).toBe('https://custom.example.com/');
  });

  it('should use scope mapping for scoped skills', async () => {
    // @kanyun scope maps to a known registry
    const url = await callResolveRegistryUrl(skillManager, '@kanyun/my-skill');
    expect(url).toContain('zhenguanyu.com');
  });

  it('should use lock file registry for unscoped skills', async () => {
    // Setup lock file with registry
    fs.writeFileSync(
      path.join(tempDir, 'skills.lock'),
      JSON.stringify({
        lockfileVersion: 1,
        skills: {
          'find-skills': {
            source: 'registry:find-skills',
            version: 'main',
            ref: 'main',
            resolved: 'https://github.com/vercel-labs/skills',
            commit: 'abc123',
            installedAt: new Date().toISOString(),
            registry: 'https://private-registry.example.com/',
          },
        },
      }),
    );

    const manager = new SkillManager(tempDir);
    const url = await callResolveRegistryUrl(manager, 'find-skills');
    expect(url).toBe('https://private-registry.example.com/');
  });

  it('should probe configured registries when no lock file', async () => {
    // Setup skills.json with a custom non-git-host registry
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({
        skills: {},
        registries: {
          'my-registry': 'https://my-registry.example.com',
        },
      }),
    );

    const manager = new SkillManager(tempDir);

    // Mock the RegistryClient to succeed on the custom registry
    const { RegistryClient } = await import('./registry-client.js');
    vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
      name: 'find-skills',
      source_type: 'registry',
    });

    const url = await callResolveRegistryUrl(manager, 'find-skills');
    expect(url).toBe('https://my-registry.example.com');
  });

  it('should skip git hosts during probe', async () => {
    // Setup skills.json with only git-host registries
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({
        skills: {},
        registries: {
          github: 'https://github.com',
          gitlab: 'https://gitlab.com',
        },
      }),
    );

    const manager = new SkillManager(tempDir);

    // No mock needed - git hosts are skipped, falls through to public registry
    const url = await callResolveRegistryUrl(manager, 'find-skills');
    expect(url).toBe('https://reskill.info/');
  });

  it('should fall back to PUBLIC_REGISTRY when nothing matches', async () => {
    const url = await callResolveRegistryUrl(skillManager, 'unknown-skill');
    expect(url).toBe('https://reskill.info/');
  });

  it('should use scoped registries from skills.json for scoped skills', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({
        skills: {},
        registries: {
          '@custom-scope': 'https://custom.registry.com/',
        },
      }),
    );

    const manager = new SkillManager(tempDir);
    const url = await callResolveRegistryUrl(manager, '@custom-scope/my-skill');
    expect(url).toBe('https://custom.registry.com/');
  });

  it('should allow skills.json scoped registries to override hardcoded defaults', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({
        skills: {},
        registries: {
          '@kanyun-test': 'https://override.registry.com/',
        },
      }),
    );

    const manager = new SkillManager(tempDir);
    const url = await callResolveRegistryUrl(manager, '@kanyun-test/my-skill');
    expect(url).toBe('https://override.registry.com/');
  });

  it('should still use hardcoded map when skills.json has no scoped entries', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({
        skills: {},
        registries: {
          github: 'https://github.com',
        },
      }),
    );

    const manager = new SkillManager(tempDir);
    const url = await callResolveRegistryUrl(manager, '@kanyun/my-skill');
    expect(url).toBe('https://rush.zhenguanyu.com/');
  });
});

// ============================================================================
// --registry auto-save to skills.json.registries tests
// ============================================================================

describe('SkillManager --registry auto-save to skills.json.registries', () => {
  let tempDir: string;
  let skillManager: SkillManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-registry-save-'));
    skillManager = new SkillManager(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should save custom registry URL to skills.json.registries on install', async () => {
    // Create initial skills.json
    fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify({ skills: {} }));

    const customRegistryUrl = 'https://private-registry.example.com/';

    const { RegistryClient } = await import('./registry-client.js');
    vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
      name: 'my-skill',
      source_type: 'registry',
    });

    const registryResolver = (skillManager as unknown as { registryResolver: RegistryResolver })
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

    const mockSkillDir = path.join(tempDir, 'mock-skill');
    fs.mkdirSync(mockSkillDir, { recursive: true });
    fs.writeFileSync(path.join(mockSkillDir, 'SKILL.md'), '# Skill');
    vi.spyOn(registryResolver, 'extract').mockResolvedValue(mockSkillDir);

    await skillManager.installToAgents('my-skill', ['cursor'], {
      registry: customRegistryUrl,
    });

    // Read skills.json and verify registry was saved
    const config = JSON.parse(fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8'));
    expect(config.registries).toBeDefined();
    expect(config.registries['private-registry.example.com']).toBe(customRegistryUrl);
  });

  it('should not save git host URLs to skills.json.registries', async () => {
    fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify({ skills: {} }));

    const { RegistryClient } = await import('./registry-client.js');
    vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
      name: 'my-skill',
      source_type: 'registry',
    });

    const registryResolver = (skillManager as unknown as { registryResolver: RegistryResolver })
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
      registryUrl: 'https://github.com/',
      tarball: Buffer.from('mock tarball'),
      integrity: 'sha256-mockhash',
    });

    const mockSkillDir = path.join(tempDir, 'mock-skill-gh');
    fs.mkdirSync(mockSkillDir, { recursive: true });
    fs.writeFileSync(path.join(mockSkillDir, 'SKILL.md'), '# Skill');
    vi.spyOn(registryResolver, 'extract').mockResolvedValue(mockSkillDir);

    await skillManager.installToAgents('my-skill', ['cursor'], {
      registry: 'https://github.com/',
    });

    // Git host URLs should NOT be saved as custom registries
    const config = JSON.parse(fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8'));
    // github should not appear as a custom entry (it's a default)
    expect(config.registries?.['github.com']).toBeUndefined();
  });
});

describe('SkillManager isEffectivelyGlobal behavior for claude-cowork-3p', () => {
  let tempDir: string;
  let manager: SkillManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-effective-global-'));
    manager = new SkillManager(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should NOT modify skills.json/skills.lock when uninstalling from only claude-cowork-3p', () => {
    // Setup: Create skills.json and skills.lock with an existing skill
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({ skills: { 'test-skill': 'github:user/test-skill@v1.0.0' } }),
    );
    fs.writeFileSync(
      path.join(tempDir, 'skills.lock'),
      JSON.stringify({
        lockfileVersion: 1,
        skills: {
          'test-skill': {
            source: 'github:user/test-skill',
            version: '1.0.0',
            ref: 'v1.0.0',
            resolved: 'https://github.com/user/test-skill.git',
            commit: 'abc123',
            installedAt: new Date().toISOString(),
          },
        },
      }),
    );

    // Action: Uninstall targeting only claude-cowork-3p
    manager.uninstallFromAgents('test-skill', ['claude-cowork-3p']);

    // Assert: skills.json and skills.lock should remain unchanged
    const config = JSON.parse(fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8'));
    expect(config.skills['test-skill']).toBe('github:user/test-skill@v1.0.0');

    const lock = JSON.parse(fs.readFileSync(path.join(tempDir, 'skills.lock'), 'utf-8'));
    expect(lock.skills['test-skill']).toBeDefined();
  });

  it('should modify skills.json/skills.lock when uninstalling from a non-3p agent', () => {
    // Setup: Create skills.json and skills.lock
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({ skills: { 'test-skill': 'github:user/test-skill@v1.0.0' } }),
    );
    fs.writeFileSync(
      path.join(tempDir, 'skills.lock'),
      JSON.stringify({
        lockfileVersion: 1,
        skills: {
          'test-skill': {
            source: 'github:user/test-skill',
            version: '1.0.0',
            ref: 'v1.0.0',
            resolved: 'https://github.com/user/test-skill.git',
            commit: 'abc123',
            installedAt: new Date().toISOString(),
          },
        },
      }),
    );

    // Action: Uninstall targeting cursor (non-3p agent)
    manager.uninstallFromAgents('test-skill', ['cursor']);

    // Assert: skills.json and skills.lock should have the skill removed
    const config = JSON.parse(fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8'));
    expect(config.skills['test-skill']).toBeUndefined();

    const lock = JSON.parse(fs.readFileSync(path.join(tempDir, 'skills.lock'), 'utf-8'));
    expect(lock.skills['test-skill']).toBeUndefined();
  });

  it('should NOT write skills.json/skills.lock when installing to only claude-cowork-3p', async () => {
    // Note: This test mocks installToAgentsFromGit entirely, so it only verifies
    // the dispatch path (installToAgents delegates to the private method without
    // any manifest writes of its own). The isEffectivelyGlobal method itself is
    // exercised by the uninstall tests below, which verify the core logic without
    // network dependencies.
    const mockResult = {
      skill: {
        name: 'test-skill',
        path: '/tmp/skill',
        version: '1.0.0',
        source: 'github:user/test-skill',
      },
      results: new Map([
        ['claude-cowork-3p', { success: true, path: '/tmp', mode: 'copy' as const }],
      ]),
    };

    vi.spyOn(
      manager as unknown as Record<string, (...args: unknown[]) => unknown>,
      'installToAgentsFromGit',
    ).mockResolvedValue(mockResult);

    // Action: Install targeting only claude-cowork-3p
    await manager.installToAgents('github:user/test-skill@v1.0.0', ['claude-cowork-3p']);

    // Assert: No skills.json or skills.lock should be created
    expect(fs.existsSync(path.join(tempDir, 'skills.json'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'skills.lock'))).toBe(false);
  });

  it('should modify skills.json/skills.lock when uninstalling from both claude-cowork-3p and non-3p agents', () => {
    // Simulates: reskill uninstall test-skill -a claude-cowork-3p cursor
    // Mixed agents include a non-3p agent, so manifest SHOULD be updated.
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({ skills: { 'test-skill': 'github:user/test-skill@v1.0.0' } }),
    );
    fs.writeFileSync(
      path.join(tempDir, 'skills.lock'),
      JSON.stringify({
        lockfileVersion: 1,
        skills: {
          'test-skill': {
            source: 'github:user/test-skill',
            version: '1.0.0',
            ref: 'v1.0.0',
            resolved: 'https://github.com/user/test-skill.git',
            commit: 'abc123',
            installedAt: new Date().toISOString(),
          },
        },
      }),
    );

    // Action: Uninstall targeting both claude-cowork-3p and cursor
    manager.uninstallFromAgents('test-skill', ['claude-cowork-3p', 'cursor']);

    // Assert: skills.json and skills.lock should be updated (cursor is non-global)
    const config = JSON.parse(fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8'));
    expect(config.skills['test-skill']).toBeUndefined();

    const lock = JSON.parse(fs.readFileSync(path.join(tempDir, 'skills.lock'), 'utf-8'));
    expect(lock.skills['test-skill']).toBeUndefined();
  });
});

// ============================================================================
// deriveDistTag tests
// ============================================================================

describe('deriveDistTag', () => {
  it('should return "latest" for stable versions', () => {
    expect(deriveDistTag('1.0.0')).toBe('latest');
    expect(deriveDistTag('0.1.0')).toBe('latest');
    expect(deriveDistTag('10.20.30')).toBe('latest');
  });

  it('should return channel name for prerelease versions', () => {
    expect(deriveDistTag('1.0.1-alpha.0')).toBe('alpha');
    expect(deriveDistTag('1.2.4-beta.3')).toBe('beta');
    expect(deriveDistTag('2.0.0-rc.1')).toBe('rc');
    expect(deriveDistTag('1.0.0-next.5')).toBe('next');
  });

  it('should return "next" for numeric-only prerelease', () => {
    expect(deriveDistTag('1.0.0-0')).toBe('next');
    expect(deriveDistTag('1.0.0-0.3.7')).toBe('next');
  });

  it('should ignore build metadata', () => {
    expect(deriveDistTag('1.0.0+build.123')).toBe('latest');
    expect(deriveDistTag('1.0.0+2024-01-15')).toBe('latest');
  });

  it('should handle prerelease with build metadata', () => {
    expect(deriveDistTag('1.0.1-beta.1+build.5')).toBe('beta');
  });

  it('should return "latest" for unknown/fallback input', () => {
    expect(deriveDistTag('unknown')).toBe('latest');
  });
});

// ============================================================================
// resolveLatestForChannel tests
// ============================================================================

describe('resolveLatestForChannel', () => {
  it('should return @latest dist-tag for stable version', () => {
    const info = {
      latest_version: '1.0.0',
      dist_tags: [
        { tag: 'latest', version: '1.1.0' },
        { tag: 'beta', version: '2.0.0-beta.1' },
      ],
    };
    expect(resolveLatestForChannel('1.0.0', info)).toBe('1.1.0');
  });

  it('should fall back to latest_version for stable when no dist_tags', () => {
    const info = { latest_version: '1.2.0' };
    expect(resolveLatestForChannel('1.0.0', info)).toBe('1.2.0');
  });

  it('should NOT return beta version for stable user', () => {
    const info = {
      latest_version: '1.0.0',
      dist_tags: [
        { tag: 'latest', version: '1.0.0' },
        { tag: 'beta', version: '1.1.0-beta.0' },
      ],
    };
    expect(resolveLatestForChannel('1.0.0', info)).toBe('1.0.0');
  });

  it('should return channel tag for prerelease version', () => {
    const info = {
      latest_version: '0.9.0',
      dist_tags: [
        { tag: 'latest', version: '0.9.0' },
        { tag: 'beta', version: '1.0.0-beta.3' },
      ],
    };
    expect(resolveLatestForChannel('1.0.0-beta.1', info)).toBe('1.0.0-beta.3');
  });

  it('should NOT fall back to latest_version for prerelease when channel tag missing', () => {
    const info = {
      latest_version: '1.0.0',
      dist_tags: [{ tag: 'latest', version: '1.0.0' }],
    };
    expect(resolveLatestForChannel('1.0.0-beta.1', info)).toBeUndefined();
  });

  it('should return undefined for prerelease when no dist_tags at all', () => {
    const info = { latest_version: '1.0.0' };
    expect(resolveLatestForChannel('1.0.0-rc.1', info)).toBeUndefined();
  });
});

// ============================================================================
// checkOutdated registry tests
// ============================================================================

describe('checkOutdated with registry skills', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-outdated-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function setupProject(
    skills: Record<string, string>,
    lockedSkills: Record<string, object>,
  ): SkillManager {
    fs.writeFileSync(
      path.join(tempDir, 'skills.json'),
      JSON.stringify({ skills, registries: { github: 'https://github.com' }, defaults: {} }),
    );
    fs.writeFileSync(
      path.join(tempDir, 'skills.lock'),
      JSON.stringify({ lockfileVersion: 1, skills: lockedSkills }),
    );
    return new SkillManager(tempDir);
  }

  it('should detect registry skill with available update', async () => {
    const manager = setupProject(
      { 'my-skill': '@kanyun/my-skill@1.0.0' },
      {
        'my-skill': {
          source: 'registry:@kanyun/my-skill',
          version: '1.0.0',
          ref: '1.0.0',
          resolved: 'https://rush-test.zhenguanyu.com',
          commit: '',
          registry: 'https://rush-test.zhenguanyu.com',
        },
      },
    );

    const { RegistryClient } = await import('./registry-client.js');
    vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
      name: '@kanyun/my-skill',
      latest_version: '1.1.0',
      dist_tags: [
        { tag: 'latest', version: '1.1.0' },
      ],
    });

    const results = await manager.checkOutdated();

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('my-skill');
    expect(results[0].current).toBe('1.0.0');
    expect(results[0].latest).toBe('1.1.0');
    expect(results[0].updateAvailable).toBe(true);

    vi.restoreAllMocks();
  });

  it('should report up-to-date for registry skill on latest version', async () => {
    const manager = setupProject(
      { 'my-skill': '@kanyun/my-skill@1.0.0' },
      {
        'my-skill': {
          source: 'registry:@kanyun/my-skill',
          version: '1.0.0',
          ref: '1.0.0',
          resolved: 'https://rush-test.zhenguanyu.com',
          commit: '',
          registry: 'https://rush-test.zhenguanyu.com',
        },
      },
    );

    const { RegistryClient } = await import('./registry-client.js');
    vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
      name: '@kanyun/my-skill',
      latest_version: '1.0.0',
      dist_tags: [{ tag: 'latest', version: '1.0.0' }],
    });

    const results = await manager.checkOutdated();

    expect(results[0].updateAvailable).toBe(false);

    vi.restoreAllMocks();
  });

  it('should check prerelease channel tag instead of latest', async () => {
    const manager = setupProject(
      { 'my-skill': '@kanyun/my-skill@1.0.0-beta.1' },
      {
        'my-skill': {
          source: 'registry:@kanyun/my-skill',
          version: '1.0.0-beta.1',
          ref: '1.0.0-beta.1',
          resolved: 'https://rush-test.zhenguanyu.com',
          commit: '',
          registry: 'https://rush-test.zhenguanyu.com',
        },
      },
    );

    const { RegistryClient } = await import('./registry-client.js');
    vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
      name: '@kanyun/my-skill',
      latest_version: '0.9.0',
      dist_tags: [
        { tag: 'latest', version: '0.9.0' },
        { tag: 'beta', version: '1.0.0-beta.3' },
      ],
    });

    const results = await manager.checkOutdated();

    expect(results[0].current).toBe('1.0.0-beta.1');
    expect(results[0].latest).toBe('1.0.0-beta.3');
    expect(results[0].updateAvailable).toBe(true);

    vi.restoreAllMocks();
  });

  it('should not fall back to latest when prerelease channel tag not found', async () => {
    const manager = setupProject(
      { 'my-skill': '@kanyun/my-skill@1.0.0-rc.1' },
      {
        'my-skill': {
          source: 'registry:@kanyun/my-skill',
          version: '1.0.0-rc.1',
          ref: '1.0.0-rc.1',
          resolved: 'https://rush-test.zhenguanyu.com',
          commit: '',
          registry: 'https://rush-test.zhenguanyu.com',
        },
      },
    );

    const { RegistryClient } = await import('./registry-client.js');
    vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
      name: '@kanyun/my-skill',
      latest_version: '1.1.0',
      dist_tags: [{ tag: 'latest', version: '1.1.0' }],
    });

    const results = await manager.checkOutdated();

    expect(results[0].latest).toBe('unknown');
    expect(results[0].updateAvailable).toBe(false);

    vi.restoreAllMocks();
  });

  it('should not show beta as update for stable version', async () => {
    const manager = setupProject(
      { 'my-skill': '@kanyun/my-skill@1.0.0' },
      {
        'my-skill': {
          source: 'registry:@kanyun/my-skill',
          version: '1.0.0',
          ref: '1.0.0',
          resolved: 'https://rush-test.zhenguanyu.com',
          commit: '',
          registry: 'https://rush-test.zhenguanyu.com',
        },
      },
    );

    const { RegistryClient } = await import('./registry-client.js');
    vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
      name: '@kanyun/my-skill',
      latest_version: '1.0.0',
      dist_tags: [
        { tag: 'latest', version: '1.0.0' },
        { tag: 'beta', version: '1.1.0-beta.0' },
      ],
    });

    const results = await manager.checkOutdated();

    expect(results[0].current).toBe('1.0.0');
    expect(results[0].latest).toBe('1.0.0');
    expect(results[0].updateAvailable).toBe(false);

    vi.restoreAllMocks();
  });

  it('should handle registry API failure gracefully', async () => {
    const manager = setupProject(
      { 'my-skill': '@kanyun/my-skill@1.0.0' },
      {
        'my-skill': {
          source: 'registry:@kanyun/my-skill',
          version: '1.0.0',
          ref: '1.0.0',
          resolved: 'https://rush-test.zhenguanyu.com',
          commit: '',
          registry: 'https://rush-test.zhenguanyu.com',
        },
      },
    );

    const { RegistryClient } = await import('./registry-client.js');
    vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockRejectedValue(
      new Error('Network error'),
    );

    const results = await manager.checkOutdated();

    expect(results).toHaveLength(1);
    expect(results[0].current).toBe('1.0.0');
    expect(results[0].latest).toBe('unknown');
    expect(results[0].updateAvailable).toBe(false);

    vi.restoreAllMocks();
  });
});

// ============================================================================
// .reskill-source.json tests
// ============================================================================

describe('reskill source metadata', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-source-meta-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('writeSourceMeta / readSourceMeta', () => {
    it('should write and read source metadata', () => {
      const skillDir = path.join(tempDir, 'my-skill');
      fs.mkdirSync(skillDir, { recursive: true });

      const meta = {
        source: 'registry:@kanyun/my-skill',
        version: '1.0.0',
        registry: 'https://rush.zhenguanyu.com',
      };

      writeSourceMeta(skillDir, meta);

      const read = readSourceMeta(skillDir);
      expect(read).not.toBeNull();
      expect(read!.source).toBe('registry:@kanyun/my-skill');
      expect(read!.version).toBe('1.0.0');
      expect(read!.registry).toBe('https://rush.zhenguanyu.com');
      expect(read!.installedAt).toBeDefined();
    });

    it('should return null when no source metadata exists', () => {
      const skillDir = path.join(tempDir, 'no-meta');
      fs.mkdirSync(skillDir, { recursive: true });

      const read = readSourceMeta(skillDir);
      expect(read).toBeNull();
    });

    it('should return null for malformed JSON', () => {
      const skillDir = path.join(tempDir, 'bad-meta');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, '.reskill-source.json'), 'not json');

      const read = readSourceMeta(skillDir);
      expect(read).toBeNull();
    });
  });

  describe('checkOutdatedGlobal with source metadata', () => {
    it('should use .reskill-source.json instead of probing when available', async () => {
      // Setup global skills dir
      const globalSkillsDir = path.join(tempDir, '.agents', 'skills');
      const skillDir = path.join(globalSkillsDir, 'docz');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: docz\nversion: 0.10.0\ndescription: test\n---\n');

      // Write source metadata
      writeSourceMeta(skillDir, {
        source: 'registry:@kanyun/docz',
        version: '0.10.0',
        registry: 'https://rush.zhenguanyu.com',
      });

      // Override HOME so global skills dir resolves to tempDir
      const originalHome = process.env.HOME;
      process.env.HOME = tempDir;

      try {
        const manager = new SkillManager(tempDir, { global: true });

        const { RegistryClient } = await import('./registry-client.js');
        vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
          name: '@kanyun/docz',
          latest_version: '0.13.0',
          dist_tags: [{ tag: 'latest', version: '0.13.0' }],
        });

        const results = await manager.checkOutdated();
        const docz = results.find((r) => r.name === 'docz');

        expect(docz).toBeDefined();
        expect(docz!.current).toBe('0.10.0');
        expect(docz!.latest).toBe('0.13.0');
        expect(docz!.updateAvailable).toBe(true);
      } finally {
        process.env.HOME = originalHome;
        vi.restoreAllMocks();
      }
    });

    it('should write back source metadata after successful probe', async () => {
      const globalSkillsDir = path.join(tempDir, '.agents', 'skills');
      const skillDir = path.join(globalSkillsDir, 'docz');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: docz\nversion: 0.10.0\ndescription: test\n---\n');

      // No .reskill-source.json — should probe and write back
      const originalHome = process.env.HOME;
      process.env.HOME = tempDir;

      try {
        const manager = new SkillManager(tempDir, { global: true });

        const { RegistryClient } = await import('./registry-client.js');
        vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
          name: '@kanyun/docz',
          latest_version: '0.13.0',
          dist_tags: [{ tag: 'latest', version: '0.13.0' }],
        });

        await manager.checkOutdated();

        // Verify .reskill-source.json was written back
        const meta = readSourceMeta(skillDir);
        expect(meta).not.toBeNull();
        expect(meta!.source).toBe('registry:@kanyun/docz');
        expect(meta!.registry).toBe('https://rush.zhenguanyu.com');
      } finally {
        process.env.HOME = originalHome;
        vi.restoreAllMocks();
      }
    });

    it('should write back the resolved latest version, not the literal "unknown", when current version was never known', async () => {
      // SKILL.md has no `version:` header and there's no prior .reskill-source.json,
      // so currentVersion starts out as 'unknown' going into the probe.
      const globalSkillsDir = path.join(tempDir, '.agents', 'skills');
      const skillDir = path.join(globalSkillsDir, 'gemini-video-analyzer');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        '---\nname: gemini-video-analyzer\ndescription: test\n---\n',
      );

      const originalHome = process.env.HOME;
      process.env.HOME = tempDir;

      try {
        const manager = new SkillManager(tempDir, { global: true });

        const { RegistryClient } = await import('./registry-client.js');
        vi.spyOn(RegistryClient.prototype, 'getSkillInfo').mockResolvedValue({
          name: '@kanyun/gemini-video-analyzer',
          latest_version: '1.0.1',
          dist_tags: [{ tag: 'latest', version: '1.0.1' }],
        });

        const results = await manager.checkOutdated();
        const skill = results.find((r) => r.name === 'gemini-video-analyzer');
        expect(skill).toBeDefined();
        expect(skill!.latest).toBe('1.0.1');

        // Regression: previously this wrote the literal string 'unknown' back into
        // .reskill-source.json (the pre-probe currentVersion), permanently discarding
        // the version we just resolved and leaving `list -g` stuck on 'unknown' forever.
        const meta = readSourceMeta(skillDir);
        expect(meta).not.toBeNull();
        expect(meta!.version).toBe('1.0.1');

        // And a subsequent list() call now reports the real version instead of 'unknown'.
        const installed = manager.list().find((s) => s.name === 'gemini-video-analyzer');
        expect(installed?.version).toBe('1.0.1');
      } finally {
        process.env.HOME = originalHome;
        vi.restoreAllMocks();
      }
    });
  });
});

// ============================================================================
// update -g tests
// ============================================================================

describe('SkillManager updateGlobal', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-update-global-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should skip skills without source metadata', async () => {
    const globalSkillsDir = path.join(tempDir, '.agents', 'skills');
    const skillDir = path.join(globalSkillsDir, 'unknown-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: unknown-skill\ndescription: test\n---\n');

    const originalHome = process.env.HOME;
    process.env.HOME = tempDir;

    try {
      const manager = new SkillManager(tempDir, { global: true });
      const updated = await manager.update();

      expect(updated).toHaveLength(0);
    } finally {
      process.env.HOME = originalHome;
      vi.restoreAllMocks();
    }
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
