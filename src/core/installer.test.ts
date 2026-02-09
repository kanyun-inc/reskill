import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getShortName } from '../utils/registry-scope.js';
import type { AgentType } from './agent-registry.js';
import { Installer } from './installer.js';

describe('Installer', () => {
  let tempDir: string;
  let installer: Installer;
  let sourceDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'installer-test-'));
    installer = new Installer({ cwd: tempDir });

    // Create source skill directory
    sourceDir = path.join(tempDir, 'source-skill');
    mkdirSync(sourceDir, { recursive: true });

    // Create SKILL.md
    const skillMd = `---
name: test-skill
description: Test skill for installer tests
---

# Test Skill

This is test content.
`;
    writeFileSync(path.join(sourceDir, 'SKILL.md'), skillMd);

    // Create additional files
    writeFileSync(path.join(sourceDir, 'helper.md'), '# Helper file');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should create installer with default options', () => {
      const defaultInstaller = new Installer();
      expect(defaultInstaller).toBeInstanceOf(Installer);
    });

    it('should create installer with custom cwd', () => {
      const customInstaller = new Installer({ cwd: tempDir });
      expect(customInstaller).toBeInstanceOf(Installer);
    });

    it('should create installer with global option', () => {
      const globalInstaller = new Installer({ global: true });
      expect(globalInstaller).toBeInstanceOf(Installer);
    });
  });

  describe('getCanonicalPath', () => {
    it('should return canonical path for skill', () => {
      const canonicalPath = installer.getCanonicalPath('test-skill');
      expect(canonicalPath).toContain('.agents/skills/test-skill');
      expect(canonicalPath).toContain(tempDir);
    });

    it('should sanitize skill name', () => {
      const canonicalPath = installer.getCanonicalPath('test/skill');
      expect(canonicalPath).not.toContain('test/skill');
      expect(canonicalPath).toContain('testskill');
    });
  });

  describe('getAgentSkillPath', () => {
    it('should return agent skill path for cursor', () => {
      const agentPath = installer.getAgentSkillPath('test-skill', 'cursor');
      expect(agentPath).toContain('.cursor/skills/test-skill');
      expect(agentPath).toContain(tempDir);
    });

    it('should return agent skill path for claude-code', () => {
      const agentPath = installer.getAgentSkillPath('test-skill', 'claude-code');
      expect(agentPath).toContain('.claude/skills/test-skill');
      expect(agentPath).toContain(tempDir);
    });
  });

  describe('installForAgent', () => {
    it('should install skill with copy mode', async () => {
      const result = await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'copy',
      });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('copy');
      expect(result.path).toContain('.cursor/skills/test-skill');
      expect(existsSync(result.path)).toBe(true);
      expect(existsSync(path.join(result.path, 'SKILL.md'))).toBe(true);
    });

    it('should install skill with symlink mode', async () => {
      const result = await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'symlink',
      });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('symlink');
      expect(result.canonicalPath).toContain('.agents/skills/test-skill');

      // Check canonical path exists
      expect(result.canonicalPath).toBeDefined();
      expect(existsSync(result.canonicalPath as string)).toBe(true);
    });

    it('should install to different agents', async () => {
      const agentTypes: AgentType[] = ['cursor', 'claude-code', 'windsurf'];

      for (const agent of agentTypes) {
        const result = await installer.installForAgent(sourceDir, `test-skill-${agent}`, agent, {
          mode: 'copy',
        });

        expect(result.success).toBe(true);
        expect(existsSync(result.path)).toBe(true);
      }
    });

    it('should fail when source does not exist', async () => {
      const result = await installer.installForAgent('/nonexistent/path', 'test-skill', 'cursor', {
        mode: 'copy',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should respect force option when skill already exists', async () => {
      // First install
      await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'copy',
      });

      // Modify source
      writeFileSync(
        path.join(sourceDir, 'SKILL.md'),
        '---\nname: test-skill\ndescription: Updated\n---\nUpdated content',
      );

      // Reinstall with force (force is implicit on overwrite)
      const result = await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'copy',
      });

      expect(result.success).toBe(true);

      // Check content is updated
      const content = readFileSync(path.join(result.path, 'SKILL.md'), 'utf-8');
      expect(content).toContain('Updated content');
    });

    it('should copy all files from source directory', async () => {
      const result = await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'copy',
      });

      expect(result.success).toBe(true);
      expect(existsSync(path.join(result.path, 'SKILL.md'))).toBe(true);
      expect(existsSync(path.join(result.path, 'helper.md'))).toBe(true);
    });
  });

  describe('installToAgents', () => {
    it('should install to multiple agents', async () => {
      const targetAgents: AgentType[] = ['cursor', 'claude-code'];

      const results = await installer.installToAgents(sourceDir, 'test-skill', targetAgents, {
        mode: 'copy',
      });

      expect(results.size).toBe(2);

      for (const agent of targetAgents) {
        const result = results.get(agent);
        expect(result).toBeDefined();
        expect(result?.success).toBe(true);
      }
    });

    it('should install with symlink mode to multiple agents', async () => {
      const targetAgents: AgentType[] = ['cursor', 'claude-code', 'windsurf'];

      const results = await installer.installToAgents(sourceDir, 'test-skill', targetAgents, {
        mode: 'symlink',
      });

      expect(results.size).toBe(3);

      // All should share the same canonical path
      const canonicalPaths = new Set<string>();
      for (const [, result] of results) {
        expect(result.success).toBe(true);
        if (result.canonicalPath) {
          canonicalPaths.add(result.canonicalPath);
        }
      }

      // Should only have one canonical path (shared)
      expect(canonicalPaths.size).toBe(1);
    });

    it('should return empty map for empty agents array', async () => {
      const results = await installer.installToAgents(sourceDir, 'test-skill', [], {
        mode: 'copy',
      });

      expect(results.size).toBe(0);
    });
  });

  describe('isInstalled', () => {
    it('should return false when skill is not installed', () => {
      const installed = installer.isInstalled('nonexistent-skill', 'cursor');
      expect(installed).toBe(false);
    });

    it('should return true when skill is installed', async () => {
      await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'copy',
      });

      const installed = installer.isInstalled('test-skill', 'cursor');
      expect(installed).toBe(true);
    });

    it('should check correct agent directory (copy mode)', async () => {
      await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'copy',
      });

      expect(installer.isInstalled('test-skill', 'cursor')).toBe(true);
      expect(installer.isInstalled('test-skill', 'claude-code')).toBe(false);
    });

    it('should check correct agent directory (symlink mode)', async () => {
      // Install to cursor only
      await installer.installForAgent(sourceDir, 'symlink-skill', 'cursor', {
        mode: 'symlink',
      });

      expect(installer.isInstalled('symlink-skill', 'cursor')).toBe(true);
      // Other agents should NOT have the skill (symlink mode still creates in specific agent dir)
      expect(installer.isInstalled('symlink-skill', 'claude-code')).toBe(false);
    });
  });

  describe('uninstallFromAgent', () => {
    it('should uninstall skill from agent', async () => {
      await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'copy',
      });

      expect(installer.isInstalled('test-skill', 'cursor')).toBe(true);

      const result = installer.uninstallFromAgent('test-skill', 'cursor');
      expect(result).toBe(true);
      expect(installer.isInstalled('test-skill', 'cursor')).toBe(false);
    });

    it('should return false when skill is not installed', () => {
      const result = installer.uninstallFromAgent('nonexistent-skill', 'cursor');
      expect(result).toBe(false);
    });

    it('should only uninstall from specified agent', async () => {
      // Install to multiple agents
      await installer.installToAgents(sourceDir, 'test-skill', ['cursor', 'claude-code'], {
        mode: 'copy',
      });

      // Uninstall from cursor only
      installer.uninstallFromAgent('test-skill', 'cursor');

      expect(installer.isInstalled('test-skill', 'cursor')).toBe(false);
      expect(installer.isInstalled('test-skill', 'claude-code')).toBe(true);
    });
  });

  describe('uninstallFromAgents', () => {
    it('should uninstall from multiple agents', async () => {
      await installer.installToAgents(sourceDir, 'test-skill', ['cursor', 'claude-code'], {
        mode: 'copy',
      });

      const results = installer.uninstallFromAgents('test-skill', ['cursor', 'claude-code']);

      expect(results.size).toBe(2);
      expect(results.get('cursor')).toBe(true);
      expect(results.get('claude-code')).toBe(true);
      expect(installer.isInstalled('test-skill', 'cursor')).toBe(false);
      expect(installer.isInstalled('test-skill', 'claude-code')).toBe(false);
    });

    it('should also remove canonical path', async () => {
      await installer.installToAgents(sourceDir, 'test-skill', ['cursor'], {
        mode: 'symlink',
      });

      const canonicalPath = installer.getCanonicalPath('test-skill');
      expect(existsSync(canonicalPath)).toBe(true);

      installer.uninstallFromAgents('test-skill', ['cursor']);

      expect(existsSync(canonicalPath)).toBe(false);
    });
  });

  describe('listInstalledSkills', () => {
    it('should return empty array when no skills installed', () => {
      const skills = installer.listInstalledSkills('cursor');
      expect(skills).toEqual([]);
    });

    it('should return installed skills', async () => {
      await installer.installForAgent(sourceDir, 'skill-1', 'cursor', { mode: 'copy' });
      await installer.installForAgent(sourceDir, 'skill-2', 'cursor', { mode: 'copy' });

      const skills = installer.listInstalledSkills('cursor');
      expect(skills).toContain('skill-1');
      expect(skills).toContain('skill-2');
      expect(skills.length).toBe(2);
    });

    it('should list skills from specific agent only', async () => {
      await installer.installForAgent(sourceDir, 'cursor-skill', 'cursor', { mode: 'copy' });
      await installer.installForAgent(sourceDir, 'claude-skill', 'claude-code', { mode: 'copy' });

      const cursorSkills = installer.listInstalledSkills('cursor');
      const claudeSkills = installer.listInstalledSkills('claude-code');

      expect(cursorSkills).toContain('cursor-skill');
      expect(cursorSkills).not.toContain('claude-skill');
      expect(claudeSkills).toContain('claude-skill');
      expect(claudeSkills).not.toContain('cursor-skill');
    });
  });

  describe('file exclusion', () => {
    it('should not copy .reskill-commit file', async () => {
      // Create .reskill-commit in source (simulating cache directory)
      writeFileSync(path.join(sourceDir, '.reskill-commit'), 'abc123def456');

      const result = await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'copy',
      });

      expect(result.success).toBe(true);
      expect(existsSync(path.join(result.path, 'SKILL.md'))).toBe(true);
      expect(existsSync(path.join(result.path, '.reskill-commit'))).toBe(false);
    });

    it('should not copy .reskill-commit file in symlink mode', async () => {
      // Create .reskill-commit in source
      writeFileSync(path.join(sourceDir, '.reskill-commit'), 'abc123def456');

      const result = await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'symlink',
      });

      expect(result.success).toBe(true);
      expect(result.canonicalPath).toBeDefined();
      expect(existsSync(path.join(result.canonicalPath as string, 'SKILL.md'))).toBe(true);
      expect(existsSync(path.join(result.canonicalPath as string, '.reskill-commit'))).toBe(false);
    });

    it('should not copy README.md file by default', async () => {
      // Create README.md in source
      writeFileSync(path.join(sourceDir, 'README.md'), '# This is a README');

      const result = await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'copy',
      });

      expect(result.success).toBe(true);
      expect(existsSync(path.join(result.path, 'SKILL.md'))).toBe(true);
      expect(existsSync(path.join(result.path, 'README.md'))).toBe(false);
    });

    it('should not copy README.md file in symlink mode', async () => {
      // Create README.md in source
      writeFileSync(path.join(sourceDir, 'README.md'), '# This is a README');

      const result = await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'symlink',
      });

      expect(result.success).toBe(true);
      expect(result.canonicalPath).toBeDefined();
      expect(existsSync(path.join(result.canonicalPath as string, 'SKILL.md'))).toBe(true);
      expect(existsSync(path.join(result.canonicalPath as string, 'README.md'))).toBe(false);
    });

    it('should not copy files starting with underscore', async () => {
      // Create files starting with underscore
      writeFileSync(path.join(sourceDir, '_private.md'), '# Private file');
      writeFileSync(path.join(sourceDir, '_internal.txt'), 'internal content');

      const result = await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'copy',
      });

      expect(result.success).toBe(true);
      expect(existsSync(path.join(result.path, 'SKILL.md'))).toBe(true);
      expect(existsSync(path.join(result.path, '_private.md'))).toBe(false);
      expect(existsSync(path.join(result.path, '_internal.txt'))).toBe(false);
    });

    it('should not copy metadata.json file', async () => {
      // Create metadata.json in source
      writeFileSync(path.join(sourceDir, 'metadata.json'), '{"internal": true}');

      const result = await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'copy',
      });

      expect(result.success).toBe(true);
      expect(existsSync(path.join(result.path, 'SKILL.md'))).toBe(true);
      expect(existsSync(path.join(result.path, 'metadata.json'))).toBe(false);
    });

    it('should copy other markdown files that are not excluded', async () => {
      // Create other markdown files
      writeFileSync(path.join(sourceDir, 'guide.md'), '# Guide');
      writeFileSync(path.join(sourceDir, 'examples.md'), '# Examples');

      const result = await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'copy',
      });

      expect(result.success).toBe(true);
      expect(existsSync(path.join(result.path, 'guide.md'))).toBe(true);
      expect(existsSync(path.join(result.path, 'examples.md'))).toBe(true);
    });
  });

  describe('custom installDir', () => {
    it('should use custom installDir for canonical path', () => {
      const customInstaller = new Installer({ cwd: tempDir, installDir: '.skills' });
      const canonicalPath = customInstaller.getCanonicalPath('test-skill');

      expect(canonicalPath).toContain('.skills/test-skill');
      expect(canonicalPath).not.toContain('.agents/skills');
    });

    it('should install to custom installDir in symlink mode', async () => {
      const customInstaller = new Installer({ cwd: tempDir, installDir: '.my-custom-skills' });

      const result = await customInstaller.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'symlink',
      });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('symlink');
      expect(result.canonicalPath).toContain('.my-custom-skills/test-skill');
      expect(result.canonicalPath).not.toContain('.agents/skills');

      // Check canonical path exists
      expect(result.canonicalPath).toBeDefined();
      expect(existsSync(result.canonicalPath as string)).toBe(true);
    });

    it('should install to custom installDir in copy mode', async () => {
      const customInstaller = new Installer({ cwd: tempDir, installDir: '.custom-dir' });

      // Copy mode installs directly to agent directory, not canonical
      const result = await customInstaller.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'copy',
      });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('copy');
      // Copy mode goes to agent directory, not canonical
      expect(result.path).toContain('.cursor/skills/test-skill');
    });

    it('should use default .agents/skills when installDir is not provided', () => {
      const defaultInstaller = new Installer({ cwd: tempDir });
      const canonicalPath = defaultInstaller.getCanonicalPath('test-skill');

      expect(canonicalPath).toContain('.agents/skills/test-skill');
    });

    it('should ignore installDir in global mode', () => {
      const globalInstaller = new Installer({
        cwd: tempDir,
        global: true,
        installDir: '.custom-dir',
      });
      const canonicalPath = globalInstaller.getCanonicalPath('test-skill');

      // Global mode should use home directory, not custom installDir
      expect(canonicalPath).toContain('.agents/skills/test-skill');
      expect(canonicalPath).not.toContain('.custom-dir');
    });

    it('should support nested custom installDir paths', async () => {
      const customInstaller = new Installer({ cwd: tempDir, installDir: 'custom/nested/skills' });

      const result = await customInstaller.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'symlink',
      });

      expect(result.success).toBe(true);
      expect(result.canonicalPath).toContain('custom/nested/skills/test-skill');
    });

    it('should uninstall from custom installDir', async () => {
      const customInstaller = new Installer({ cwd: tempDir, installDir: '.skills' });

      // Install first
      await customInstaller.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'symlink',
      });

      const canonicalPath = customInstaller.getCanonicalPath('test-skill');
      expect(existsSync(canonicalPath)).toBe(true);

      // Uninstall
      customInstaller.uninstallFromAgents('test-skill', ['cursor']);

      expect(existsSync(canonicalPath)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle skill names with hyphens', async () => {
      const result = await installer.installForAgent(sourceDir, 'my-awesome-skill', 'cursor', {
        mode: 'copy',
      });

      expect(result.success).toBe(true);
      expect(result.path).toContain('my-awesome-skill');
    });

    it('should handle skill names with numbers', async () => {
      const result = await installer.installForAgent(sourceDir, 'skill123', 'cursor', {
        mode: 'copy',
      });

      expect(result.success).toBe(true);
      expect(result.path).toContain('skill123');
    });

    it('should create nested directories if needed', async () => {
      const deepDir = path.join(tempDir, 'deep', 'nested', 'path');
      const deepInstaller = new Installer({ cwd: deepDir });

      const result = await deepInstaller.installForAgent(sourceDir, 'test-skill', 'cursor', {
        mode: 'copy',
      });

      expect(result.success).toBe(true);
      expect(existsSync(result.path)).toBe(true);
    });
  });

  // ============================================================================
  // Cursor bridge rule file tests
  // ============================================================================

  describe('Cursor bridge rule files', () => {
    const getBridgeRulePath = (skillName: string) =>
      path.join(tempDir, '.cursor', 'rules', `${skillName}.mdc`);

    const BRIDGE_MARKER = '<!-- reskill:auto-generated -->';

    describe('install creates bridge file', () => {
      it('should create .mdc bridge file when installing to cursor with copy mode', async () => {
        await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
          mode: 'copy',
        });

        const bridgePath = getBridgeRulePath('test-skill');
        expect(existsSync(bridgePath)).toBe(true);
      });

      it('should create .mdc bridge file when installing to cursor with symlink mode', async () => {
        await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
          mode: 'symlink',
        });

        const bridgePath = getBridgeRulePath('test-skill');
        expect(existsSync(bridgePath)).toBe(true);
      });

      it('should include description from SKILL.md in bridge file', async () => {
        await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
          mode: 'copy',
        });

        const bridgePath = getBridgeRulePath('test-skill');
        const content = readFileSync(bridgePath, 'utf-8');
        expect(content).toContain('description: "Test skill for installer tests"');
      });

      it('should include auto-generated marker in bridge file', async () => {
        await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
          mode: 'copy',
        });

        const bridgePath = getBridgeRulePath('test-skill');
        const content = readFileSync(bridgePath, 'utf-8');
        expect(content).toContain(BRIDGE_MARKER);
      });

      it('should reference correct SKILL.md path in bridge file', async () => {
        await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
          mode: 'copy',
        });

        const bridgePath = getBridgeRulePath('test-skill');
        const content = readFileSync(bridgePath, 'utf-8');
        expect(content).toContain('@file .cursor/skills/test-skill/SKILL.md');
      });

      it('should include alwaysApply: false in bridge file', async () => {
        await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
          mode: 'copy',
        });

        const bridgePath = getBridgeRulePath('test-skill');
        const content = readFileSync(bridgePath, 'utf-8');
        expect(content).toContain('alwaysApply: false');
      });

      it('should create .cursor/rules/ directory if it does not exist', async () => {
        const rulesDir = path.join(tempDir, '.cursor', 'rules');
        expect(existsSync(rulesDir)).toBe(false);

        await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
          mode: 'copy',
        });

        expect(existsSync(rulesDir)).toBe(true);
      });
    });

    describe('install does NOT create bridge file', () => {
      it('should NOT create bridge file for non-cursor agents', async () => {
        await installer.installForAgent(sourceDir, 'test-skill', 'claude-code', {
          mode: 'copy',
        });

        const bridgePath = getBridgeRulePath('test-skill');
        expect(existsSync(bridgePath)).toBe(false);
      });

      it('should NOT create bridge file for global installation', async () => {
        const globalInstaller = new Installer({ cwd: tempDir, global: true });

        await globalInstaller.installForAgent(sourceDir, 'test-skill', 'cursor', {
          mode: 'copy',
        });

        const bridgePath = getBridgeRulePath('test-skill');
        expect(existsSync(bridgePath)).toBe(false);
      });

      it('should skip bridge file silently when SKILL.md has no frontmatter', async () => {
        // Overwrite SKILL.md with no frontmatter
        writeFileSync(path.join(sourceDir, 'SKILL.md'), '# Just content, no frontmatter');

        const result = await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
          mode: 'copy',
        });

        expect(result.success).toBe(true);
        const bridgePath = getBridgeRulePath('test-skill');
        expect(existsSync(bridgePath)).toBe(false);
      });
    });

    describe('uninstall removes bridge file', () => {
      it('should remove bridge file when uninstalling from cursor', async () => {
        await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
          mode: 'copy',
        });

        const bridgePath = getBridgeRulePath('test-skill');
        expect(existsSync(bridgePath)).toBe(true);

        installer.uninstallFromAgent('test-skill', 'cursor');
        expect(existsSync(bridgePath)).toBe(false);
      });

      it('should NOT remove manually created .mdc without auto-generated marker', async () => {
        // Manually create a .mdc file without the marker
        const rulesDir = path.join(tempDir, '.cursor', 'rules');
        mkdirSync(rulesDir, { recursive: true });
        const bridgePath = getBridgeRulePath('test-skill');
        writeFileSync(bridgePath, '---\ndescription: Manual rule\n---\n\nManual content');

        // Install then uninstall
        await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
          mode: 'copy',
        });
        installer.uninstallFromAgent('test-skill', 'cursor');

        // Manually created .mdc should still exist
        expect(existsSync(bridgePath)).toBe(true);
        const content = readFileSync(bridgePath, 'utf-8');
        expect(content).toContain('Manual content');
      });

      it('should NOT attempt to remove bridge file for non-cursor agents', async () => {
        // Install to both cursor and claude-code
        await installer.installForAgent(sourceDir, 'test-skill', 'cursor', { mode: 'copy' });
        await installer.installForAgent(sourceDir, 'test-skill', 'claude-code', { mode: 'copy' });

        const bridgePath = getBridgeRulePath('test-skill');
        expect(existsSync(bridgePath)).toBe(true);

        // Uninstall only from claude-code
        installer.uninstallFromAgent('test-skill', 'claude-code');

        // Bridge file should still exist (only cursor uninstall removes it)
        expect(existsSync(bridgePath)).toBe(true);
      });
    });

    describe('reinstall overwrites bridge file', () => {
      it('should overwrite bridge file with updated description on reinstall', async () => {
        // First install
        await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
          mode: 'copy',
        });

        const bridgePath = getBridgeRulePath('test-skill');
        const content1 = readFileSync(bridgePath, 'utf-8');
        expect(content1).toContain('Test skill for installer tests');

        // Update SKILL.md with new description
        writeFileSync(
          path.join(sourceDir, 'SKILL.md'),
          '---\nname: test-skill\ndescription: Updated skill description\n---\n\n# Updated',
        );

        // Reinstall
        await installer.installForAgent(sourceDir, 'test-skill', 'cursor', {
          mode: 'copy',
        });

        const content2 = readFileSync(bridgePath, 'utf-8');
        expect(content2).toContain('Updated skill description');
        expect(content2).not.toContain('Test skill for installer tests');
      });
    });
  });

  // ============================================================================
  // Scoped skill name handling tests
  // ============================================================================

  describe('scoped skill name handling', () => {
    it('should extract short name from scoped skill name', () => {
      // getShortName is used to get directory name from scoped skill name
      expect(getShortName('@kanyun/planning-with-files')).toBe('planning-with-files');
      expect(getShortName('@myorg/my-skill')).toBe('my-skill');
      expect(getShortName('simple-skill')).toBe('simple-skill');
    });

    it('should install scoped skill using short name as directory', async () => {
      // When installing @kanyun/planning-with-files, the directory should be 'planning-with-files'
      const scopedSkillName = '@kanyun/planning-with-files';
      const shortName = getShortName(scopedSkillName);

      const result = await installer.installForAgent(sourceDir, shortName, 'cursor', {
        mode: 'copy',
      });

      expect(result.success).toBe(true);
      expect(result.path).toContain('planning-with-files');
      expect(result.path).not.toContain('@kanyun');
      expect(existsSync(result.path)).toBe(true);
    });

    it('should use short name for canonical path', () => {
      const scopedSkillName = '@kanyun/my-skill';
      const shortName = getShortName(scopedSkillName);

      const canonicalPath = installer.getCanonicalPath(shortName);

      expect(canonicalPath).toContain('my-skill');
      expect(canonicalPath).not.toContain('@kanyun');
    });

    it('should use short name for agent skill path', () => {
      const scopedSkillName = '@other/test-skill';
      const shortName = getShortName(scopedSkillName);

      const agentPath = installer.getAgentSkillPath(shortName, 'cursor');

      expect(agentPath).toContain('test-skill');
      expect(agentPath).not.toContain('@other');
    });
  });
});
