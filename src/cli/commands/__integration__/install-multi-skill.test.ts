/**
 * Integration tests for install --skill and --list (multi-skill repository)
 *
 * Uses local file:// git repos only; no network.
 */

import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createLocalMultiSkillRepo,
  createTempDir,
  getOutput,
  pathExists,
  readSkillsJson,
  removeTempDir,
  runCli,
} from './helpers.js';

describe('CLI Integration: install --skill / --list (multi-skill repo)', () => {
  let tempDir: string;
  let repoUrl: string;

  beforeEach(() => {
    tempDir = createTempDir();
    runCli('init -y', tempDir);
    repoUrl = createLocalMultiSkillRepo(tempDir, 'multi-skills', [
      { name: 'pdf', description: 'PDF processing' },
      { name: 'commit', description: 'Commit helper' },
      { name: 'pr-review', description: 'PR review' },
    ]);
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  describe('--list', () => {
    it('should list available skills without installing', () => {
      const result = runCli(`install ${repoUrl} --list`, tempDir);
      const output = getOutput(result);
      expect(result.exitCode).toBe(0);
      expect(output).toContain('pdf');
      expect(output).toContain('commit');
      expect(output).toContain('pr-review');
      expect(output).toMatch(/Available skills|skill\(s\)/i);
      expect(pathExists(path.join(tempDir, '.agents', 'skills', 'pdf'))).toBe(false);
    });
  });

  describe('--skill single', () => {
    it('should install one skill by name', () => {
      const result = runCli(`install ${repoUrl} --skill pdf -a cursor -y`, tempDir);
      expect(result.exitCode).toBe(0);
      expect(pathExists(path.join(tempDir, '.cursor', 'skills', 'pdf'))).toBe(true);
      expect(pathExists(path.join(tempDir, '.cursor', 'skills', 'pdf', 'SKILL.md'))).toBe(true);
      expect(pathExists(path.join(tempDir, '.cursor', 'skills', 'commit'))).toBe(false);
    });

    it('should save skill with ref#name in skills.json', () => {
      const result = runCli(`install ${repoUrl} --skill pdf -a cursor -y`, tempDir);
      expect(result.exitCode).toBe(0);
      const config = readSkillsJson(tempDir);
      expect(config.skills?.pdf).toBeDefined();
      expect(config.skills.pdf).toMatch(/#pdf$/);
    });
  });

  describe('--skill multiple', () => {
    it('should install multiple skills', () => {
      const result = runCli(`install ${repoUrl} --skill pdf commit -a cursor -y`, tempDir);
      expect(result.exitCode).toBe(0);
      expect(pathExists(path.join(tempDir, '.cursor', 'skills', 'pdf', 'SKILL.md'))).toBe(true);
      expect(pathExists(path.join(tempDir, '.cursor', 'skills', 'commit', 'SKILL.md'))).toBe(true);
      expect(pathExists(path.join(tempDir, '.cursor', 'skills', 'pr-review'))).toBe(false);
    });

    it('should record each skill in skills.json', () => {
      const res = runCli(`install ${repoUrl} --skill pdf commit -a cursor -y`, tempDir);
      expect(res.exitCode).toBe(0);
      const config = readSkillsJson(tempDir);
      expect(config.skills?.pdf).toMatch(/#pdf$/);
      expect(config.skills?.commit).toMatch(/#commit$/);
    });
  });

  describe('error cases', () => {
    it('should exit with error when skill name not found', () => {
      const result = runCli(`install ${repoUrl} --skill nonexistent -a cursor -y`, tempDir);
      expect(result.exitCode).toBe(1);
      const output = getOutput(result);
      expect(output).toMatch(/No matching skills|not found|Available skills/i);
      expect(output).toContain('pdf');
    });
  });

  describe('--force', () => {
    it('should re-install skill when --force is used', () => {
      // First install
      const first = runCli(`install ${repoUrl} --skill pdf -a cursor -y`, tempDir);
      expect(first.exitCode).toBe(0);
      expect(pathExists(path.join(tempDir, '.cursor', 'skills', 'pdf', 'SKILL.md'))).toBe(true);

      // Second install with --force should actually reinstall
      const second = runCli(`install ${repoUrl} --skill pdf -a cursor -y --force`, tempDir);
      expect(second.exitCode).toBe(0);
      const secondOutput = getOutput(second);
      expect(secondOutput).toMatch(/Installed|Installing/i);
      expect(pathExists(path.join(tempDir, '.cursor', 'skills', 'pdf', 'SKILL.md'))).toBe(true);
    });

    it('should skip already-installed skill without --force', () => {
      // First install
      runCli(`install ${repoUrl} --skill pdf -a cursor -y`, tempDir);

      // Second install without --force should skip
      const second = runCli(`install ${repoUrl} --skill pdf -a cursor -y`, tempDir);
      expect(second.exitCode).toBe(0);
      const output = getOutput(second);
      expect(output).toMatch(/already installed|skipping/i);
    });
  });

  describe('--no-save', () => {
    it('should not modify skills.json when --no-save is used', () => {
      const configBefore = readSkillsJson(tempDir);
      const skillsBefore = configBefore.skills ?? {};

      const result = runCli(`install ${repoUrl} --skill pdf -a cursor -y --no-save`, tempDir);
      expect(result.exitCode).toBe(0);
      expect(pathExists(path.join(tempDir, '.cursor', 'skills', 'pdf', 'SKILL.md'))).toBe(true);

      // skills.json should not have the new skill entry
      const configAfter = readSkillsJson(tempDir);
      const skillsAfter = configAfter.skills ?? {};
      expect(skillsAfter).toEqual(skillsBefore);
    });
  });

  describe('with other options', () => {
    it('should work with -a cursor and -y', () => {
      const result = runCli(`install ${repoUrl} --skill pdf -a cursor -y`, tempDir);
      expect(result.exitCode).toBe(0);
      expect(pathExists(path.join(tempDir, '.cursor', 'skills', 'pdf', 'SKILL.md'))).toBe(true);
    });

    it('should show install command help with --skill in description', () => {
      const result = runCli('install --help', tempDir);
      const output = getOutput(result);
      expect(output).toMatch(/--skill|skill/i);
    });
  });
});
