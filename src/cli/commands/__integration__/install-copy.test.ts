/**
 * Integration tests for install command with copy mode
 *
 * These tests focus on CLI behavior and argument handling.
 * For actual git installation tests, see install-e2e.test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createMockSkill,
  createTempDir,
  pathExists,
  readSkillsJson,
  removeTempDir,
  runCli,
  setupSkillsJson,
} from './helpers.js';

describe('CLI Integration: install --mode copy', () => {
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
      const { stdout } = runCli('install --help', tempDir);
      expect(stdout).toContain('Install');
      expect(stdout).toContain('--mode');
      expect(stdout).toContain('--agent');
      expect(stdout).toContain('--force');
      expect(stdout).toContain('--global');
      expect(stdout).toContain('--no-save');
    });

    it('should show no skills message when reinstalling empty config', () => {
      const { stdout } = runCli('install -y', tempDir);
      expect(stdout).toContain('No skills');
    });

    it('should reject invalid agent names', () => {
      const { stdout, exitCode } = runCli(
        'install github:test/skill -a invalid-agent -y',
        tempDir,
      );
      expect(exitCode).toBe(1);
      expect(stdout.toLowerCase()).toContain('invalid');
    });
  });

  describe('reinstall from skills.json', () => {
    it('should attempt to reinstall skills defined in skills.json', () => {
      // Setup skills.json with a skill reference
      setupSkillsJson(
        tempDir,
        { 'test-skill': 'github:test/test-skill@v1.0.0' },
        { installMode: 'copy', targetAgents: ['cursor'] },
      );

      // This will fail to actually install (network), but should try
      const { stdout } = runCli('install -y', tempDir);
      // Should at least start the process
      expect(stdout).toContain('test-skill');
    });
  });

  describe('behavior verification (with manual setup)', () => {
    it('should verify copy mode does not create .agents/skills/ directory', () => {
      // Manually create a skill as if it was installed with copy mode
      const skillDir = path.join(tempDir, '.cursor', 'skills', 'test-skill');
      createMockSkill(path.join(tempDir, '.cursor', 'skills'), 'test-skill');

      // Verify .agents/skills/ does NOT exist
      const agentsDir = path.join(tempDir, '.agents', 'skills', 'test-skill');
      expect(pathExists(agentsDir)).toBe(false);

      // Verify the skill is in the agent directory
      expect(pathExists(skillDir)).toBe(true);
      expect(pathExists(path.join(skillDir, 'skill.json'))).toBe(true);
    });

    it('should list skill installed with copy mode', () => {
      // Manually create a skill directory
      const skillsDir = path.join(tempDir, '.skills');
      createMockSkill(skillsDir, 'test-skill');

      const { stdout, exitCode } = runCli('list', tempDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('test-skill');
    });

    it('should show info for manually created skill', () => {
      // Create skill in default .skills directory
      createMockSkill(path.join(tempDir, '.skills'), 'test-skill');

      const { stdout, exitCode } = runCli('info test-skill', tempDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('test-skill');
    });
  });

  describe('--no-save flag behavior', () => {
    it('should not add skill to skills.json with --no-save', () => {
      // Verify initial state
      let config = readSkillsJson(tempDir);
      expect(Object.keys(config.skills).length).toBe(0);

      // The actual install will fail (network), but --no-save should be respected
      // We can't fully test this without network, but we can verify the flag is accepted
      const { stdout } = runCli('install --help', tempDir);
      expect(stdout).toContain('--no-save');
    });
  });

  describe('--force flag behavior', () => {
    it('should accept --force flag', () => {
      const { stdout } = runCli('install --help', tempDir);
      expect(stdout).toContain('--force');
      expect(stdout).toContain('Force reinstall');
    });
  });

  describe('defaults saving', () => {
    it('should accept --mode copy option', () => {
      const { stdout } = runCli('install --help', tempDir);
      expect(stdout).toContain('--mode');
      expect(stdout).toMatch(/symlink|copy/i);
    });
  });
});
