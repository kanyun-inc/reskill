/**
 * Integration tests for basic CLI commands
 *
 * Tests: --version, --help, init, list, info, outdated
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createMockSkill,
  createTempDir,
  getOutput,
  pathExists,
  readSkillsJson,
  removeTempDir,
  runCli,
  setupSkillsJson,
} from './helpers.js';

// ============================================================================
// Version & Help Tests
// ============================================================================

describe('CLI Integration: Version & Help', () => {
  it('should show version with --version flag', () => {
    const { stdout, exitCode } = runCli('--version');
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it('should show help with --help flag', () => {
    const { stdout, exitCode } = runCli('--help');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('AI Skills Package Manager');
    expect(stdout).toContain('init');
    expect(stdout).toContain('install');
    expect(stdout).toContain('list');
    expect(stdout).toContain('uninstall');
    expect(stdout).toContain('update');
    expect(stdout).toContain('info');
    expect(stdout).toContain('outdated');
  });
});

// ============================================================================
// Init Command Tests
// ============================================================================

describe('CLI Integration: init', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it('should create skills.json with default installDir', () => {
    const { exitCode } = runCli('init -y', tempDir);
    expect(exitCode).toBe(0);

    const configPath = path.join(tempDir, 'skills.json');
    expect(pathExists(configPath)).toBe(true);

    const config = readSkillsJson(tempDir);
    expect(config.skills).toEqual({});
    expect(config.defaults.installDir).toBe('.skills');
  });

  it('should create skills.json with custom installDir using -d flag', () => {
    const { exitCode } = runCli('init -y -d custom-skills', tempDir);
    expect(exitCode).toBe(0);

    const config = readSkillsJson(tempDir);
    expect(config.defaults.installDir).toBe('custom-skills');
  });

  it('should warn if skills.json already exists', () => {
    // First init
    runCli('init -y', tempDir);

    // Second init should warn
    const { stdout, exitCode } = runCli('init -y', tempDir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('already exists');
  });
});

// ============================================================================
// List Command Tests
// ============================================================================

describe('CLI Integration: list', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    runCli('init -y', tempDir);
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it('should show no skills message when empty', () => {
    const { stdout } = runCli('list', tempDir);
    expect(stdout).toContain('No skills');
  });

  it('should output JSON format with --json flag when skills exist', () => {
    // Create a skill directory first
    const skillDir = path.join(tempDir, '.skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'skill.json'),
      JSON.stringify({ name: 'test-skill', version: '1.0.0' }),
    );

    const { stdout, exitCode } = runCli('list --json', tempDir);
    expect(exitCode).toBe(0);
    // Output contains JSON array (may have other text before it)
    expect(stdout).toContain('[');
    expect(stdout).toContain('test-skill');
  });

  it('should list installed skills when they exist', () => {
    // Create a skill directory manually
    const skillDir = path.join(tempDir, '.skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'skill.json'),
      JSON.stringify({ name: 'test-skill', version: '1.0.0' }),
    );

    const { stdout, exitCode } = runCli('list', tempDir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('test-skill');
  });

  it('should list skills with JSON format when skills exist', () => {
    // Create a skill directory
    const skillDir = path.join(tempDir, '.skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'skill.json'),
      JSON.stringify({ name: 'test-skill', version: '1.0.0' }),
    );

    const { stdout, exitCode } = runCli('list --json', tempDir);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  it('should support -g flag for global skills', () => {
    const { exitCode } = runCli('list -g', tempDir);
    // Should not error (may return empty list)
    expect(exitCode).toBe(0);
  });
});

// ============================================================================
// Info Command Tests
// ============================================================================

describe('CLI Integration: info', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    runCli('init -y', tempDir);
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it('should show not found for nonexistent skill', () => {
    const result = runCli('info nonexistent', tempDir);
    expect(result.exitCode).toBe(1);
    // Error message may be in stdout or stderr
    const output = getOutput(result);
    expect(output.toLowerCase()).toContain('not found');
  });

  it('should show skill info when skill exists', () => {
    // Create a skill directory
    const skillDir = path.join(tempDir, '.skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'skill.json'),
      JSON.stringify({ name: 'test-skill', version: '1.0.0' }),
    );
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '# Test Skill\n\nA test skill for testing.',
    );

    const { stdout, exitCode } = runCli('info test-skill', tempDir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('test-skill');
  });

  it('should output JSON format with --json flag', () => {
    // Create a skill directory
    const skillDir = path.join(tempDir, '.skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'skill.json'),
      JSON.stringify({ name: 'test-skill', version: '1.0.0' }),
    );

    const { stdout, exitCode } = runCli('info test-skill --json', tempDir);
    expect(exitCode).toBe(0);
    // Output should contain JSON
    expect(stdout).toContain('{');
    expect(stdout).toContain('test-skill');
  });
});

// ============================================================================
// Outdated Command Tests
// ============================================================================

describe('CLI Integration: outdated', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    runCli('init -y', tempDir);
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it('should show no skills defined message when empty', () => {
    const { stdout } = runCli('outdated', tempDir);
    expect(stdout).toContain('No skills defined');
  });

  it('should support --json flag', () => {
    const { exitCode } = runCli('outdated --json', tempDir);
    expect(exitCode).toBe(0);
  });

  it('should check for updates when skills are defined', () => {
    // Setup skills.json with a skill
    setupSkillsJson(tempDir, {
      'test-skill': 'github:test/test-skill@v1.0.0',
    });

    // Create local skill
    const skillDir = path.join(tempDir, '.skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'skill.json'),
      JSON.stringify({ name: 'test-skill', version: '1.0.0' }),
    );

    const { exitCode } = runCli('outdated', tempDir);
    // Should run without error (may fail to fetch from GitHub)
    expect(exitCode).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// Command Help Tests
// ============================================================================

describe('CLI Integration: Command Help', () => {
  it('should show install help with --help', () => {
    const { stdout } = runCli('install --help');
    expect(stdout).toContain('Install');
    expect(stdout).toContain('--agent');
    expect(stdout).toContain('--mode');
    expect(stdout).toContain('--force');
    expect(stdout).toContain('--global');
  });

  it('should show uninstall help with --help', () => {
    const { stdout } = runCli('uninstall --help');
    expect(stdout).toContain('Uninstall');
    expect(stdout).toContain('--global');
    expect(stdout).toContain('--yes');
  });

  it('should show update help with --help', () => {
    const { stdout } = runCli('update --help');
    expect(stdout).toContain('Update');
    expect(stdout).toContain('skill');
  });

  it('should show completion help with --help', () => {
    const { stdout } = runCli('completion --help');
    expect(stdout.toLowerCase()).toContain('completion');
  });
});
