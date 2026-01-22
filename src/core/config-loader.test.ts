import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SkillsJson } from '../types/index.js';
import { ConfigLoader } from './config-loader.js';

describe('ConfigLoader', () => {
  let tempDir: string;
  let configLoader: ConfigLoader;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-config-test-'));
    configLoader = new ConfigLoader(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('getProjectRoot', () => {
    it('should return project root', () => {
      expect(configLoader.getProjectRoot()).toBe(tempDir);
    });
  });

  describe('getConfigPath', () => {
    it('should return config path', () => {
      expect(configLoader.getConfigPath()).toBe(path.join(tempDir, 'skills.json'));
    });
  });

  describe('exists', () => {
    it('should return false when config does not exist', () => {
      expect(configLoader.exists()).toBe(false);
    });

    it('should return true when config exists', () => {
      fs.writeFileSync(path.join(tempDir, 'skills.json'), '{}');
      expect(configLoader.exists()).toBe(true);
    });
  });

  describe('create', () => {
    it('should create default config', () => {
      const config = configLoader.create();

      expect(config.skills).toEqual({});
      expect(config.defaults?.installDir).toBe('.skills');
      expect(fs.existsSync(path.join(tempDir, 'skills.json'))).toBe(true);
    });

    it('should create config with custom options', () => {
      const config = configLoader.create({
        defaults: {
          installDir: 'custom-skills',
        },
      });

      expect(config.defaults?.installDir).toBe('custom-skills');
    });
  });

  describe('load', () => {
    it('should throw when config does not exist', () => {
      expect(() => configLoader.load()).toThrow('skills.json not found');
    });

    it('should load existing config', () => {
      const testConfig: SkillsJson = {
        skills: { 'my-skill': 'github:user/skill@v1.0.0' },
      };
      fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify(testConfig));

      const loaded = configLoader.load();
      expect(loaded.skills['my-skill']).toBe('github:user/skill@v1.0.0');
    });

    it('should throw on invalid JSON', () => {
      fs.writeFileSync(path.join(tempDir, 'skills.json'), 'invalid json');
      expect(() => configLoader.load()).toThrow('Failed to parse skills.json');
    });
  });

  describe('save', () => {
    it('should save config', () => {
      configLoader.create();
      configLoader.addSkill('test-skill', 'github:user/skill@v1.0.0');

      const content = fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.skills['test-skill']).toBe('github:user/skill@v1.0.0');
    });
  });

  describe('getDefaults', () => {
    it('should return default values when no config', () => {
      const defaults = configLoader.getDefaults();
      expect(defaults.installDir).toBe('.skills');
      expect(defaults.targetAgents).toEqual([]);
      expect(defaults.installMode).toBe('symlink');
    });

    it('should return config values', () => {
      configLoader.create({
        defaults: {
          installDir: 'custom',
        },
      });

      const defaults = configLoader.getDefaults();
      expect(defaults.installDir).toBe('custom');
    });

    it('should return stored targetAgents and installMode', () => {
      configLoader.create({
        defaults: {
          targetAgents: ['cursor', 'claude-code'],
          installMode: 'copy',
        },
      });

      const defaults = configLoader.getDefaults();
      expect(defaults.targetAgents).toEqual(['cursor', 'claude-code']);
      expect(defaults.installMode).toBe('copy');
    });
  });

  describe('updateDefaults', () => {
    beforeEach(() => {
      configLoader.create();
    });

    it('should update targetAgents', () => {
      configLoader.updateDefaults({
        targetAgents: ['cursor', 'claude-code'],
      });

      const defaults = configLoader.getDefaults();
      expect(defaults.targetAgents).toEqual(['cursor', 'claude-code']);
      // Other defaults should remain unchanged
      expect(defaults.installDir).toBe('.skills');
    });

    it('should update installMode', () => {
      configLoader.updateDefaults({
        installMode: 'copy',
      });

      const defaults = configLoader.getDefaults();
      expect(defaults.installMode).toBe('copy');
    });

    it('should update multiple defaults at once', () => {
      configLoader.updateDefaults({
        targetAgents: ['windsurf'],
        installMode: 'copy',
      });

      const defaults = configLoader.getDefaults();
      expect(defaults.targetAgents).toEqual(['windsurf']);
      expect(defaults.installMode).toBe('copy');
    });

    it('should persist updates to file', () => {
      configLoader.updateDefaults({
        targetAgents: ['cursor'],
        installMode: 'symlink',
      });

      // Create new loader to read from file
      const newLoader = new ConfigLoader(tempDir);
      const defaults = newLoader.getDefaults();
      expect(defaults.targetAgents).toEqual(['cursor']);
      expect(defaults.installMode).toBe('symlink');
    });

    it('should merge with existing defaults', () => {
      configLoader.updateDefaults({
        targetAgents: ['cursor'],
      });
      configLoader.updateDefaults({
        installMode: 'copy',
      });

      const defaults = configLoader.getDefaults();
      expect(defaults.targetAgents).toEqual(['cursor']);
      expect(defaults.installMode).toBe('copy');
    });
  });

  describe('getInstallDir', () => {
    it('should return default install directory', () => {
      expect(configLoader.getInstallDir()).toBe(path.join(tempDir, '.skills'));
    });

    it('should return custom install directory', () => {
      configLoader.create({
        defaults: { installDir: 'my-skills' },
      });
      expect(configLoader.getInstallDir()).toBe(path.join(tempDir, 'my-skills'));
    });
  });

  describe('ensureExists', () => {
    it('should create skills.json if not exists', () => {
      expect(configLoader.exists()).toBe(false);

      configLoader.ensureExists();

      expect(configLoader.exists()).toBe(true);
      const config = configLoader.load();
      expect(config.skills).toEqual({});
      expect(config.defaults?.installDir).toBe('.skills');
    });

    it('should not overwrite existing skills.json', () => {
      // Create with custom config
      configLoader.create({
        skills: { 'existing-skill': 'github:user/skill@v1.0.0' },
      });

      // ensureExists should not overwrite
      configLoader.ensureExists();

      const config = configLoader.load();
      expect(config.skills['existing-skill']).toBe('github:user/skill@v1.0.0');
    });

    it('should return true if skills.json was created', () => {
      const created = configLoader.ensureExists();
      expect(created).toBe(true);
    });

    it('should return false if skills.json already exists', () => {
      configLoader.create();
      const created = configLoader.ensureExists();
      expect(created).toBe(false);
    });
  });

  describe('skill management', () => {
    beforeEach(() => {
      configLoader.create();
    });

    it('should add skill', () => {
      configLoader.addSkill('my-skill', 'github:user/skill@v1.0.0');
      expect(configLoader.hasSkill('my-skill')).toBe(true);
      expect(configLoader.getSkillRef('my-skill')).toBe('github:user/skill@v1.0.0');
    });

    it('should remove skill', () => {
      configLoader.addSkill('my-skill', 'github:user/skill@v1.0.0');
      const removed = configLoader.removeSkill('my-skill');

      expect(removed).toBe(true);
      expect(configLoader.hasSkill('my-skill')).toBe(false);
    });

    it('should return false when removing non-existent skill', () => {
      const removed = configLoader.removeSkill('non-existent');
      expect(removed).toBe(false);
    });

    it('should get all skills', () => {
      configLoader.addSkill('skill1', 'github:user/skill1@v1.0.0');
      configLoader.addSkill('skill2', 'github:user/skill2@v2.0.0');

      const skills = configLoader.getSkills();
      expect(Object.keys(skills)).toHaveLength(2);
      expect(skills.skill1).toBe('github:user/skill1@v1.0.0');
      expect(skills.skill2).toBe('github:user/skill2@v2.0.0');
    });
  });
});
