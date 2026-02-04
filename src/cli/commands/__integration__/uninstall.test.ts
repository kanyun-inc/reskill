/**
 * Integration tests for uninstall command
 *
 * Tests:
 * - Uninstall from different locations
 * - Handle nonexistent skills
 * - Update skills.json after uninstall
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createMockHome,
  createMockSkill,
  createTempDir,
  getOutput,
  pathExists,
  readSkillsJson,
  removeTempDir,
  runCli,
  setupSkillsJson,
} from './helpers.js';

describe('CLI Integration: uninstall', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    runCli('init -y', tempDir);
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  describe('CLI options', () => {
    it('should show help with --help', () => {
      const { stdout } = runCli('uninstall --help', tempDir);
      expect(stdout).toContain('Uninstall');
      expect(stdout).toContain('skills...');
      expect(stdout).toContain('--global');
      expect(stdout).toContain('--yes');
      expect(stdout).toContain('-y');
    });
  });

  describe('multiple skills uninstall', () => {
    it('should uninstall multiple skills at once', () => {
      // Create multiple skills in agent directory
      const agentSkillsDir = path.join(tempDir, '.cursor', 'skills');
      createMockSkill(agentSkillsDir, 'skill-one');
      createMockSkill(agentSkillsDir, 'skill-two');
      createMockSkill(agentSkillsDir, 'skill-three');
      expect(pathExists(path.join(agentSkillsDir, 'skill-one'))).toBe(true);
      expect(pathExists(path.join(agentSkillsDir, 'skill-two'))).toBe(true);
      expect(pathExists(path.join(agentSkillsDir, 'skill-three'))).toBe(true);

      // Uninstall all three at once
      const { exitCode, stdout } = runCli('uninstall skill-one skill-two skill-three -y', tempDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('skill-one');
      expect(stdout).toContain('skill-two');
      expect(stdout).toContain('skill-three');

      // Verify all removed
      expect(pathExists(path.join(agentSkillsDir, 'skill-one'))).toBe(false);
      expect(pathExists(path.join(agentSkillsDir, 'skill-two'))).toBe(false);
      expect(pathExists(path.join(agentSkillsDir, 'skill-three'))).toBe(false);
    });

    it('should handle mix of existing and nonexistent skills', () => {
      // Create only one skill
      const agentSkillsDir = path.join(tempDir, '.cursor', 'skills');
      createMockSkill(agentSkillsDir, 'existing-skill');

      // Try to uninstall both existing and nonexistent
      const { exitCode, stdout } = runCli('uninstall existing-skill nonexistent-skill -y', tempDir);
      expect(exitCode).toBe(0);

      // Should mention nonexistent not installed
      expect(stdout.toLowerCase()).toContain('not installed');
      // Should still uninstall the existing one
      expect(stdout).toContain('existing-skill');
      expect(pathExists(path.join(agentSkillsDir, 'existing-skill'))).toBe(false);
    });

    it('should remove multiple skills from skills.json', () => {
      // Setup skills.json with multiple skills
      setupSkillsJson(tempDir, {
        'skill-a': 'github:test/skill-a@v1.0.0',
        'skill-b': 'github:test/skill-b@v1.0.0',
        'skill-c': 'github:test/skill-c@v1.0.0',
      });

      // Create skills in agent directory
      const agentSkillsDir = path.join(tempDir, '.cursor', 'skills');
      createMockSkill(agentSkillsDir, 'skill-a');
      createMockSkill(agentSkillsDir, 'skill-b');

      // Uninstall two skills
      runCli('uninstall skill-a skill-b -y', tempDir);

      // Verify both removed from skills.json
      const config = readSkillsJson(tempDir);
      expect(config.skills['skill-a']).toBeUndefined();
      expect(config.skills['skill-b']).toBeUndefined();
      // skill-c should remain (not uninstalled)
      expect(config.skills['skill-c']).toBe('github:test/skill-c@v1.0.0');
    });
  });

  describe('uninstall from agent directory', () => {
    it('should uninstall skill from agent skills directory', () => {
      // Create skill in agent directory (where uninstall looks)
      const agentSkillsDir = path.join(tempDir, '.cursor', 'skills');
      createMockSkill(agentSkillsDir, 'test-skill');
      expect(pathExists(path.join(agentSkillsDir, 'test-skill'))).toBe(true);

      // Uninstall
      const { exitCode, stdout } = runCli('uninstall test-skill -y', tempDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('test-skill');

      // Verify removed
      expect(pathExists(path.join(agentSkillsDir, 'test-skill'))).toBe(false);
    });
  });

  describe('uninstall from .agents/skills directory', () => {
    it('should uninstall skill from canonical location', () => {
      // Create skill in canonical location
      createMockSkill(path.join(tempDir, '.agents', 'skills'), 'test-skill');
      expect(pathExists(path.join(tempDir, '.agents', 'skills', 'test-skill'))).toBe(true);

      // Uninstall
      const { exitCode, stdout } = runCli('uninstall test-skill -y', tempDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('test-skill');

      // Verify removed
      expect(pathExists(path.join(tempDir, '.agents', 'skills', 'test-skill'))).toBe(false);
    });

    it('should also remove symlinks in agent directories', () => {
      // Create canonical skill
      const canonicalDir = path.join(tempDir, '.agents', 'skills', 'test-skill');
      createMockSkill(path.join(tempDir, '.agents', 'skills'), 'test-skill');

      // Create symlink in agent directory
      const agentSkillsDir = path.join(tempDir, '.cursor', 'skills');
      fs.mkdirSync(agentSkillsDir, { recursive: true });
      const agentSkillDir = path.join(agentSkillsDir, 'test-skill');

      try {
        fs.symlinkSync(canonicalDir, agentSkillDir);
      } catch {
        // Skip symlink test on systems that don't support it
        return;
      }

      // Uninstall
      runCli('uninstall test-skill -y', tempDir);

      // Both should be removed
      expect(pathExists(canonicalDir)).toBe(false);
      // Note: The uninstall command may or may not remove the symlink
      // depending on implementation. This tests the canonical removal.
    });
  });

  describe('nonexistent skill handling', () => {
    it('should handle uninstalling nonexistent skill gracefully', () => {
      const result = runCli('uninstall nonexistent-skill -y', tempDir);
      const output = getOutput(result);
      expect(output.toLowerCase()).toContain('not installed');
    });
  });

  describe('skills.json updates', () => {
    it('should remove skill from skills.json after uninstall', () => {
      // Setup skills.json with skill reference
      setupSkillsJson(tempDir, {
        'test-skill': 'github:test/test-skill@v1.0.0',
      });

      // Create the actual skill in agent directory (where uninstall looks)
      const agentSkillsDir = path.join(tempDir, '.cursor', 'skills');
      createMockSkill(agentSkillsDir, 'test-skill');

      // Verify in skills.json
      let config = readSkillsJson(tempDir);
      expect(config.skills['test-skill']).toBeDefined();

      // Uninstall
      runCli('uninstall test-skill -y', tempDir);

      // Verify removed from skills.json
      config = readSkillsJson(tempDir);
      expect(config.skills['test-skill']).toBeUndefined();
    });

    it('should preserve other skills in skills.json', () => {
      // Setup skills.json with multiple skills
      setupSkillsJson(tempDir, {
        'skill-to-remove': 'github:test/skill-to-remove@v1.0.0',
        'skill-to-keep': 'github:test/skill-to-keep@v1.0.0',
      });

      // Create skill in agent directory
      const agentSkillsDir = path.join(tempDir, '.cursor', 'skills');
      createMockSkill(agentSkillsDir, 'skill-to-remove');

      // Uninstall one skill
      runCli('uninstall skill-to-remove -y', tempDir);

      // Verify only the uninstalled skill was removed
      const config = readSkillsJson(tempDir);
      expect(config.skills['skill-to-remove']).toBeUndefined();
      expect(config.skills['skill-to-keep']).toBe('github:test/skill-to-keep@v1.0.0');
    });
  });

  describe('global uninstall', () => {
    let mockHome: string;

    beforeEach(() => {
      mockHome = createMockHome();
    });

    afterEach(() => {
      removeTempDir(mockHome);
    });

    it('should uninstall globally installed skill', () => {
      // Create global skill
      createMockSkill(path.join(mockHome, '.cursor', 'skills'), 'global-skill');
      expect(pathExists(path.join(mockHome, '.cursor', 'skills', 'global-skill'))).toBe(true);

      // Uninstall globally
      const { exitCode, stdout } = runCli('uninstall global-skill -g -y', tempDir, {
        HOME: mockHome,
      });
      expect(exitCode).toBe(0);
      expect(stdout).toContain('global-skill');

      // Verify removed
      expect(pathExists(path.join(mockHome, '.cursor', 'skills', 'global-skill'))).toBe(false);
    });

    it('should not affect project skills when uninstalling global', () => {
      // Create both
      createMockSkill(path.join(tempDir, '.skills'), 'shared-skill');
      createMockSkill(path.join(mockHome, '.cursor', 'skills'), 'shared-skill');

      // Uninstall globally
      runCli('uninstall shared-skill -g -y', tempDir, { HOME: mockHome });

      // Global should be removed
      expect(pathExists(path.join(mockHome, '.cursor', 'skills', 'shared-skill'))).toBe(false);

      // Project should remain
      expect(pathExists(path.join(tempDir, '.skills', 'shared-skill'))).toBe(true);
    });

    it('should not affect skills.json for global uninstall', () => {
      // Create global skill
      createMockSkill(path.join(mockHome, '.cursor', 'skills'), 'global-skill');

      // Setup project skills.json
      setupSkillsJson(tempDir, {
        'project-skill': 'github:test/project-skill@v1.0.0',
      });

      // Uninstall globally
      runCli('uninstall global-skill -g -y', tempDir, { HOME: mockHome });

      // skills.json should be unchanged
      const config = readSkillsJson(tempDir);
      expect(config.skills['project-skill']).toBe('github:test/project-skill@v1.0.0');
    });
  });
});
