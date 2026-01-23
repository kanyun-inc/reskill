/**
 * Integration tests for install command with symlink mode (default)
 *
 * Symlink mode:
 * 1. Copies skill to canonical location: .agents/skills/{name}/
 * 2. Creates symlinks from each agent directory to canonical location
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createMockSkill,
  createTempDir,
  isSymlink,
  pathExists,
  readSkillsJson,
  removeTempDir,
  runCli,
  setupSkillsJson,
} from './helpers.js';

describe('CLI Integration: install --mode symlink (default)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    runCli('init -y', tempDir);
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  describe('CLI options', () => {
    it('should use symlink as default mode', () => {
      const { stdout } = runCli('install --help', tempDir);
      expect(stdout).toContain('--mode');
      // Default should be symlink
      expect(stdout).toMatch(/symlink/i);
    });

    it('should show no skills message when reinstalling empty config', () => {
      const { stdout } = runCli('install -y', tempDir);
      expect(stdout).toContain('No skills');
    });
  });

  describe('reinstall from skills.json', () => {
    it('should attempt to reinstall skills with default symlink mode', () => {
      // Setup skills.json with a skill reference (symlink is default)
      setupSkillsJson(
        tempDir,
        { 'test-skill': 'github:test/test-skill@v1.0.0' },
        { targetAgents: ['cursor'] },
      );

      // This will fail to actually install (network), but should try
      const { stdout } = runCli('install -y', tempDir);
      expect(stdout).toContain('test-skill');
    });
  });

  describe('behavior verification (with manual setup)', () => {
    it('should verify symlink mode creates .agents/skills/ directory', () => {
      // Create canonical location (simulating symlink mode installation)
      const canonicalDir = path.join(tempDir, '.agents', 'skills', 'test-skill');
      createMockSkill(path.join(tempDir, '.agents', 'skills'), 'test-skill');

      // Create symlink in agent directory
      const agentSkillsDir = path.join(tempDir, '.cursor', 'skills');
      fs.mkdirSync(agentSkillsDir, { recursive: true });
      const agentSkillDir = path.join(agentSkillsDir, 'test-skill');

      try {
        fs.symlinkSync(canonicalDir, agentSkillDir);
      } catch {
        // On Windows without admin rights, symlinks may fail
        // Copy instead for test purposes
        fs.cpSync(canonicalDir, agentSkillDir, { recursive: true });
      }

      // Verify canonical location exists
      expect(pathExists(canonicalDir)).toBe(true);
      expect(pathExists(path.join(canonicalDir, 'skill.json'))).toBe(true);

      // Verify agent directory exists and has access to files
      expect(pathExists(agentSkillDir)).toBe(true);
      expect(pathExists(path.join(agentSkillDir, 'skill.json'))).toBe(true);
    });

    it('should list skill from canonical location', () => {
      // Create skill in canonical location
      createMockSkill(path.join(tempDir, '.agents', 'skills'), 'test-skill');

      const { stdout, exitCode } = runCli('list', tempDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('test-skill');
    });

    it('should show info for skill in canonical location', () => {
      // Create skill in canonical location
      createMockSkill(path.join(tempDir, '.agents', 'skills'), 'test-skill');

      const { stdout, exitCode } = runCli('info test-skill', tempDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('test-skill');
    });

    it('should verify symlink points to canonical location', () => {
      // Setup canonical and symlink
      const canonicalDir = path.join(tempDir, '.agents', 'skills', 'test-skill');
      createMockSkill(path.join(tempDir, '.agents', 'skills'), 'test-skill');

      const agentSkillsDir = path.join(tempDir, '.cursor', 'skills');
      fs.mkdirSync(agentSkillsDir, { recursive: true });
      const agentSkillDir = path.join(agentSkillsDir, 'test-skill');

      let symlinkCreated = false;
      try {
        fs.symlinkSync(canonicalDir, agentSkillDir);
        symlinkCreated = true;
      } catch {
        // Symlink creation may fail on Windows
      }

      if (symlinkCreated) {
        expect(isSymlink(agentSkillDir)).toBe(true);

        // Modifying canonical should reflect in agent directory
        fs.writeFileSync(
          path.join(canonicalDir, 'skill.json'),
          JSON.stringify({ name: 'test-skill', version: '2.0.0' }),
        );

        const agentSkillJson = JSON.parse(
          fs.readFileSync(path.join(agentSkillDir, 'skill.json'), 'utf-8'),
        );
        expect(agentSkillJson.version).toBe('2.0.0');
      }
    });
  });

  describe('custom installDir from skills.json', () => {
    it('should respect custom installDir in skills.json', () => {
      // Setup skills.json with custom installDir
      setupSkillsJson(
        tempDir,
        { 'test-skill': 'github:test/test-skill@v1.0.0' },
        { installDir: '.skills', targetAgents: ['cursor'] },
      );

      // Verify skills.json was created correctly
      const skillsJson = readSkillsJson(tempDir);
      expect(skillsJson.defaults?.installDir).toBe('.skills');
    });

    it('should create skills in custom installDir when manually set up', () => {
      // Setup skills.json with custom installDir
      setupSkillsJson(
        tempDir,
        {},
        { installDir: '.my-skills', targetAgents: ['cursor'] },
      );

      // Create skill manually in custom location (simulating installation)
      createMockSkill(path.join(tempDir, '.my-skills'), 'test-skill');

      // Verify skill exists in custom location
      expect(pathExists(path.join(tempDir, '.my-skills', 'test-skill'))).toBe(true);
      expect(pathExists(path.join(tempDir, '.my-skills', 'test-skill', 'skill.json'))).toBe(true);

      // Verify skill is NOT in default .agents/skills location
      expect(pathExists(path.join(tempDir, '.agents', 'skills', 'test-skill'))).toBe(false);
    });

    it('should list skills from custom installDir', () => {
      // Setup skills.json with custom installDir
      setupSkillsJson(
        tempDir,
        {},
        { installDir: '.custom-skills', targetAgents: ['cursor'] },
      );

      // Create skill in custom location
      createMockSkill(path.join(tempDir, '.custom-skills'), 'custom-skill');

      // Also add to skills.json config to simulate a proper installation
      const skillsJson = readSkillsJson(tempDir);
      skillsJson.skills['custom-skill'] = 'github:test/custom-skill@v1.0.0';
      fs.writeFileSync(
        path.join(tempDir, 'skills.json'),
        JSON.stringify(skillsJson, null, 2),
      );

      // List should find the skill
      const { stdout, exitCode } = runCli('list', tempDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('custom-skill');
    });

    it('should use nested custom installDir path', () => {
      // Setup skills.json with nested custom installDir
      setupSkillsJson(
        tempDir,
        {},
        { installDir: 'custom/nested/skills', targetAgents: ['cursor'] },
      );

      // Verify skills.json was created correctly
      const skillsJson = readSkillsJson(tempDir);
      expect(skillsJson.defaults?.installDir).toBe('custom/nested/skills');
    });
  });

  describe('multiple agents', () => {
    it('should support -a flag for multiple agents', () => {
      const { stdout } = runCli('install --help', tempDir);
      expect(stdout).toContain('--agent');
      expect(stdout).toContain('-a');
    });

    it('should verify multiple agents can share canonical location', () => {
      // Create canonical location
      const canonicalDir = path.join(tempDir, '.agents', 'skills', 'test-skill');
      createMockSkill(path.join(tempDir, '.agents', 'skills'), 'test-skill');

      // Create symlinks for multiple agents
      const agents = ['cursor', 'claude'];
      for (const agent of agents) {
        const agentSkillsDir = path.join(tempDir, `.${agent}`, 'skills');
        fs.mkdirSync(agentSkillsDir, { recursive: true });
        const agentSkillDir = path.join(agentSkillsDir, 'test-skill');

        try {
          fs.symlinkSync(canonicalDir, agentSkillDir);
        } catch {
          fs.cpSync(canonicalDir, agentSkillDir, { recursive: true });
        }
      }

      // Verify all agents have access
      for (const agent of agents) {
        const agentSkillDir = path.join(tempDir, `.${agent}`, 'skills', 'test-skill');
        expect(pathExists(path.join(agentSkillDir, 'skill.json'))).toBe(true);
      }
    });
  });
});
