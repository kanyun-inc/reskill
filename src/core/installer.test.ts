import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
});
