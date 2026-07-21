/**
 * Integration tests for the --base-dir option
 *
 * --base-dir relocates the project root that skills.json, skills.lock and every
 * agent's skills directory resolve against. This is what lets a host keep
 * several agent definitions side by side under one parent directory and install
 * an independent skill set into each of them.
 *
 * Layout under test:
 *
 *   <temp>/agents/foo/.claude/skills/<skill>
 *   <temp>/agents/foo/.cursor/skills/<skill>
 *   <temp>/agents/foo/skills.json
 *   <temp>/agents/bar/...            (independent)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createLocalGitRepo,
  createTempDir,
  getOutput,
  pathExists,
  removeTempDir,
  runCli,
} from './helpers.js';

describe('CLI Integration: install --base-dir', () => {
  let tempDir: string;
  let repoUrl: string;
  let fooDir: string;
  let barDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    fooDir = path.join(tempDir, 'agents', 'foo');
    barDir = path.join(tempDir, 'agents', 'bar');
    fs.mkdirSync(fooDir, { recursive: true });
    fs.mkdirSync(barDir, { recursive: true });
    repoUrl = createLocalGitRepo(tempDir, 'demo-skill');
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  describe('help output', () => {
    it('should advertise --base-dir on install', () => {
      const { stdout, exitCode } = runCli('install --help', tempDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('--base-dir');
    });

    it.each([
      'list',
      'update',
      'outdated',
      'uninstall',
    ])('should advertise --base-dir on %s', (command) => {
      const { stdout, exitCode } = runCli(`${command} --help`, tempDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('--base-dir');
    });
  });

  describe('installing into a relocated project root', () => {
    it('should install into the base dir instead of the current directory', () => {
      const { exitCode } = runCli(
        `install ${repoUrl}@v1.0.0 --base-dir agents/foo -a claude-code -y`,
        tempDir,
      );

      expect(exitCode).toBe(0);
      expect(pathExists(path.join(fooDir, '.claude/skills/demo-skill'))).toBe(true);
    });

    it('should leave the current directory untouched', () => {
      runCli(`install ${repoUrl}@v1.0.0 --base-dir agents/foo -a claude-code -y`, tempDir);

      expect(pathExists(path.join(tempDir, '.claude'))).toBe(false);
      expect(pathExists(path.join(tempDir, 'skills.json'))).toBe(false);
    });

    it('should write skills.json and skills.lock inside the base dir', () => {
      runCli(`install ${repoUrl}@v1.0.0 --base-dir agents/foo -a claude-code -y`, tempDir);

      expect(pathExists(path.join(fooDir, 'skills.json'))).toBe(true);
      expect(pathExists(path.join(fooDir, 'skills.lock'))).toBe(true);
    });

    it('should keep each agent layout under one base dir when several are targeted', () => {
      const { exitCode } = runCli(
        `install ${repoUrl}@v1.0.0 --base-dir agents/foo -a claude-code cursor -y`,
        tempDir,
      );

      expect(exitCode).toBe(0);
      expect(pathExists(path.join(fooDir, '.claude/skills/demo-skill'))).toBe(true);
      expect(pathExists(path.join(fooDir, '.cursor/skills/demo-skill'))).toBe(true);
    });

    it('should accept an absolute base dir', () => {
      const { exitCode } = runCli(
        `install ${repoUrl}@v1.0.0 --base-dir ${fooDir} -a claude-code -y`,
        tempDir,
      );

      expect(exitCode).toBe(0);
      expect(pathExists(path.join(fooDir, '.claude/skills/demo-skill'))).toBe(true);
    });
  });

  describe('isolation between sibling base dirs', () => {
    it('should not leak an install from one base dir into its sibling', () => {
      runCli(`install ${repoUrl}@v1.0.0 --base-dir agents/foo -a claude-code -y`, tempDir);

      expect(pathExists(path.join(fooDir, '.claude/skills/demo-skill'))).toBe(true);
      expect(pathExists(path.join(barDir, '.claude'))).toBe(false);
      expect(pathExists(path.join(barDir, 'skills.json'))).toBe(false);
    });

    it('should let sibling base dirs hold different agent sets', () => {
      runCli(`install ${repoUrl}@v1.0.0 --base-dir agents/foo -a claude-code cursor -y`, tempDir);
      runCli(`install ${repoUrl}@v1.0.0 --base-dir agents/bar -a claude-code -y`, tempDir);

      expect(pathExists(path.join(fooDir, '.cursor/skills/demo-skill'))).toBe(true);
      // bar never targeted cursor, so it must not have gained that directory
      expect(pathExists(path.join(barDir, '.cursor/skills/demo-skill'))).toBe(false);
      expect(pathExists(path.join(barDir, '.claude/skills/demo-skill'))).toBe(true);
    });
  });

  describe('list reads back from the same base dir', () => {
    it('should list the skill installed into that base dir', () => {
      runCli(`install ${repoUrl}@v1.0.0 --base-dir agents/foo -a claude-code -y`, tempDir);

      const { stdout, exitCode } = runCli('list --base-dir agents/foo', tempDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('demo-skill');
    });

    it('should report nothing for a sibling base dir', () => {
      runCli(`install ${repoUrl}@v1.0.0 --base-dir agents/foo -a claude-code -y`, tempDir);

      const { stdout } = runCli('list --base-dir agents/bar', tempDir);
      expect(stdout).not.toContain('demo-skill');
    });

    it('should report nothing for the current directory', () => {
      runCli(`install ${repoUrl}@v1.0.0 --base-dir agents/foo -a claude-code -y`, tempDir);

      const { stdout } = runCli('list', tempDir);
      expect(stdout).not.toContain('demo-skill');
    });
  });

  describe('rejecting invalid usage', () => {
    it.each([
      'install some-skill',
      'list',
      'update',
      'outdated',
      'uninstall some-skill',
    ])('should exit 1 for a missing base dir on `%s`', (command) => {
      const { exitCode } = runCli(`${command} --base-dir agents/nope -y`, tempDir);
      expect(exitCode).toBe(1);
    });

    it('should explain that the base dir was not found', () => {
      const result = runCli('list --base-dir agents/nope', tempDir);
      expect(getOutput(result)).toContain('--base-dir directory not found');
    });

    it('should reject --base-dir combined with --global', () => {
      const result = runCli('list --base-dir agents/foo -g', tempDir);
      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('cannot be combined with --global');
    });

    it('should reject a base dir that points at a file', () => {
      const filePath = path.join(tempDir, 'not-a-dir.txt');
      fs.writeFileSync(filePath, 'x');

      const result = runCli(`list --base-dir ${filePath}`, tempDir);
      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('must point to a directory');
    });
  });
});
