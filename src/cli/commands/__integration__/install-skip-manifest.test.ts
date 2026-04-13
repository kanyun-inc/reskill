/**
 * Integration tests for install --skip-manifest flag
 *
 * Verifies that --skip-manifest (and RESKILL_NO_MANIFEST env var)
 * prevents skills.json and skills.lock from being created or modified,
 * while still installing skill files normally.
 *
 * Uses createLocalMultiSkillRepo (git init -b main) for CI compatibility.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createLocalMultiSkillRepo,
  createTempDir,
  pathExists,
  removeTempDir,
  runCli,
} from './helpers.js';

describe('CLI Integration: install --skip-manifest', () => {
  let tempDir: string;
  let repoUrl: string;

  beforeEach(() => {
    tempDir = createTempDir();
    repoUrl = createLocalMultiSkillRepo(tempDir, 'test-repo', [
      { name: 'test-skill', description: 'A test skill' },
    ]);
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it('should install skill files without creating skills.json or skills.lock', () => {
    const { exitCode, stdout, stderr } = runCli(
      `install ${repoUrl} --skill test-skill -a cursor --mode copy -y --skip-manifest`,
      tempDir,
    );

    expect(exitCode, `install failed:\nstdout: ${stdout}\nstderr: ${stderr}`).toBe(0);
    expect(pathExists(path.join(tempDir, '.cursor', 'skills', 'test-skill', 'SKILL.md'))).toBe(
      true,
    );
    expect(pathExists(path.join(tempDir, 'skills.json'))).toBe(false);
    expect(pathExists(path.join(tempDir, 'skills.lock'))).toBe(false);
  });

  it('should not modify existing skills.json when --skip-manifest is used', () => {
    const existingConfig = { skills: { existing: 'github:user/existing' }, defaults: {} };
    fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify(existingConfig, null, 2));

    const { exitCode, stdout, stderr } = runCli(
      `install ${repoUrl} --skill test-skill -a cursor --mode copy -y --skip-manifest`,
      tempDir,
    );

    expect(exitCode, `install failed:\nstdout: ${stdout}\nstderr: ${stderr}`).toBe(0);
    const config = JSON.parse(fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8'));
    expect(config.skills).toEqual({ existing: 'github:user/existing' });
    expect(config.skills['test-skill']).toBeUndefined();
  });

  it('should support RESKILL_NO_MANIFEST env var', () => {
    const { exitCode, stdout, stderr } = runCli(
      `install ${repoUrl} --skill test-skill -a cursor --mode copy -y`,
      tempDir,
      { RESKILL_NO_MANIFEST: '1' },
    );

    expect(exitCode, `install failed:\nstdout: ${stdout}\nstderr: ${stderr}`).toBe(0);
    expect(pathExists(path.join(tempDir, '.cursor', 'skills', 'test-skill', 'SKILL.md'))).toBe(
      true,
    );
    expect(pathExists(path.join(tempDir, 'skills.json'))).toBe(false);
    expect(pathExists(path.join(tempDir, 'skills.lock'))).toBe(false);
  });

  it('should show --skip-manifest in help output', () => {
    const { stdout } = runCli('install --help', tempDir);
    expect(stdout).toContain('--skip-manifest');
  });
});
