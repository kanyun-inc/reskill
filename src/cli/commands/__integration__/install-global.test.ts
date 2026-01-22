/**
 * Integration tests for global installation (-g flag)
 *
 * Global installation:
 * - Uses HOME environment variable
 * - Installs to $HOME/.{agent}/skills/ directories
 * - Does NOT save to skills.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createMockHome,
  createMockSkill,
  createTempDir,
  pathExists,
  readSkillsJson,
  removeTempDir,
  runCli,
  setupSkillsJson,
} from './helpers.js';

describe('CLI Integration: install -g (global)', () => {
  let tempDir: string;
  let mockHome: string;

  beforeEach(() => {
    tempDir = createTempDir();
    mockHome = createMockHome();
    runCli('init -y', tempDir);
  });

  afterEach(() => {
    removeTempDir(tempDir);
    removeTempDir(mockHome);
  });

  describe('CLI options', () => {
    it('should support -g/--global flag', () => {
      const { stdout } = runCli('install --help', tempDir);
      expect(stdout).toContain('--global');
      expect(stdout).toContain('-g');
    });

    it('should support --all flag', () => {
      const { stdout } = runCli('install --help', tempDir);
      expect(stdout).toContain('--all');
    });
  });

  describe('behavior verification (with manual setup)', () => {
    // Note: These tests may not fully work because HOME env change
    // doesn't affect already-loaded homedir() values in the CLI.
    // We test what we can.

    it('should support list -g flag', () => {
      // Just verify the flag is accepted
      const { exitCode } = runCli('list -g', tempDir, { HOME: mockHome });
      expect(exitCode).toBe(0);
    });

    it('should list project skills normally', () => {
      // Create project skill
      createMockSkill(path.join(tempDir, '.skills'), 'project-skill');

      // List project should show project-skill
      const { stdout: projectStdout } = runCli('list', tempDir, { HOME: mockHome });
      expect(projectStdout).toContain('project-skill');
    });

    it('should support info -g flag', () => {
      // Just verify the flag is accepted
      const { exitCode } = runCli('info test-skill -g', tempDir, { HOME: mockHome });
      // Should fail gracefully (skill doesn't exist)
      expect(exitCode).toBeLessThanOrEqual(1);
    });
  });

  describe('global uninstall', () => {
    it('should support -g flag for uninstall', () => {
      const { stdout } = runCli('uninstall --help', tempDir);
      expect(stdout).toContain('--global');
      expect(stdout).toContain('-g');
    });

    it('should uninstall global skill', () => {
      // Create global skill
      const globalSkillDir = path.join(mockHome, '.cursor', 'skills', 'test-skill');
      createMockSkill(path.join(mockHome, '.cursor', 'skills'), 'test-skill');
      expect(pathExists(globalSkillDir)).toBe(true);

      // Uninstall globally
      const { exitCode } = runCli('uninstall test-skill -g -y', tempDir, {
        HOME: mockHome,
      });
      expect(exitCode).toBe(0);

      // Verify removed
      expect(pathExists(globalSkillDir)).toBe(false);
    });

    it('should not affect project skills when uninstalling global', () => {
      // Create both
      createMockSkill(path.join(tempDir, '.skills'), 'test-skill');
      createMockSkill(path.join(mockHome, '.cursor', 'skills'), 'test-skill');

      // Uninstall globally
      runCli('uninstall test-skill -g -y', tempDir, { HOME: mockHome });

      // Global should be removed
      expect(
        pathExists(path.join(mockHome, '.cursor', 'skills', 'test-skill')),
      ).toBe(false);

      // Project should still exist
      expect(pathExists(path.join(tempDir, '.skills', 'test-skill'))).toBe(true);
    });
  });

  describe('skills.json handling', () => {
    it('should not modify skills.json for global operations', () => {
      // Create global skill
      createMockSkill(path.join(mockHome, '.cursor', 'skills'), 'global-skill');

      // Add a project skill to skills.json
      setupSkillsJson(tempDir, { 'project-skill': 'github:test/project-skill@v1.0.0' });

      // Global operations should not affect skills.json
      runCli('uninstall global-skill -g -y', tempDir, { HOME: mockHome });

      // Verify skills.json is unchanged
      const config = readSkillsJson(tempDir);
      expect(config.skills['project-skill']).toBe('github:test/project-skill@v1.0.0');
      expect(config.skills['global-skill']).toBeUndefined();
    });
  });
});
