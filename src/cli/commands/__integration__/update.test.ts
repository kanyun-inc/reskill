/**
 * Integration tests for update command
 *
 * Tests:
 * - Update without skills.json
 * - Update with no skills defined
 * - CLI options
 */

import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createMockSkill,
  createTempDir,
  getOutput,
  pathExists,
  removeTempDir,
  runCli,
  setupSkillsJson,
} from './helpers.js';

describe('CLI Integration: update', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  describe('CLI options', () => {
    it('should show help with --help', () => {
      const { stdout } = runCli('update --help', tempDir);
      expect(stdout).toContain('Update');
      expect(stdout).toContain('skill');
    });
  });

  describe('error handling', () => {
    it('should error when no skills.json exists', () => {
      const result = runCli('update', tempDir);
      expect(result.exitCode).toBe(1);
      // Error message may be in stdout or stderr
      const output = getOutput(result);
      expect(output.toLowerCase()).toMatch(/skills\.json|not found|init/i);
    });

    it('should show message when no skills defined', () => {
      // Create empty skills.json
      runCli('init -y', tempDir);

      const { stdout } = runCli('update', tempDir);
      expect(stdout).toContain('No skills');
    });
  });

  describe('update with defined skills', () => {
    it('should attempt to update skills from skills.json', () => {
      runCli('init -y', tempDir);

      // Setup skills.json with a skill
      setupSkillsJson(tempDir, {
        'test-skill': 'github:test/test-skill@v1.0.0',
      });

      // Create the installed skill directory
      createMockSkill(path.join(tempDir, '.skills'), 'test-skill');

      // Update will try to check for updates (may fail due to network)
      const { stdout } = runCli('update', tempDir);
      // Should at least start the update process
      expect(stdout).toContain('test-skill');
    });

    it('should update single skill when name provided', () => {
      runCli('init -y', tempDir);

      // Setup skills.json
      setupSkillsJson(tempDir, {
        'skill-a': 'github:test/skill-a@v1.0.0',
        'skill-b': 'github:test/skill-b@v1.0.0',
      });

      // Create installed skill
      createMockSkill(path.join(tempDir, '.skills'), 'skill-a');

      // Update single skill
      const { stdout } = runCli('update skill-a', tempDir);
      expect(stdout).toContain('skill-a');
      // Should only mention the specified skill
      expect(stdout).not.toContain('skill-b');
    });
  });

  describe('skill not in config', () => {
    it('should handle updating skill not in skills.json', () => {
      runCli('init -y', tempDir);

      const result = runCli('update nonexistent-skill', tempDir);
      const output = getOutput(result);
      // CLI may show "no skills to update" or "not found" depending on implementation
      expect(output.toLowerCase()).toMatch(/not found|no skills|error|failed/i);
    });
  });
});
