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
      expect(config.defaults?.registry).toBe('github');
      expect(config.defaults?.installDir).toBe('.skills');
      expect(fs.existsSync(path.join(tempDir, 'skills.json'))).toBe(true);
    });

    it('should create config with custom options', () => {
      const config = configLoader.create({
        name: 'my-project',
        defaults: {
          registry: 'gitlab',
          installDir: 'custom-skills',
        },
      });

      expect(config.name).toBe('my-project');
      expect(config.defaults?.registry).toBe('gitlab');
      expect(config.defaults?.installDir).toBe('custom-skills');
    });
  });

  describe('load', () => {
    it('should throw when config does not exist', () => {
      expect(() => configLoader.load()).toThrow('skills.json not found');
    });

    it('should load existing config', () => {
      const testConfig: SkillsJson = {
        name: 'test',
        skills: { 'my-skill': 'github:user/skill@v1.0.0' },
      };
      fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify(testConfig));

      const loaded = configLoader.load();
      expect(loaded.name).toBe('test');
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
      expect(defaults.registry).toBe('github');
      expect(defaults.installDir).toBe('.skills');
    });

    it('should return config values', () => {
      configLoader.create({
        defaults: {
          registry: 'gitlab',
          installDir: 'custom',
        },
      });

      const defaults = configLoader.getDefaults();
      expect(defaults.registry).toBe('gitlab');
      expect(defaults.installDir).toBe('custom');
    });
  });

  describe('getRegistryUrl', () => {
    it('should return default registry URLs', () => {
      expect(configLoader.getRegistryUrl('github')).toBe('https://github.com');
      expect(configLoader.getRegistryUrl('gitlab')).toBe('https://gitlab.com');
    });

    it('should return custom registry URL', () => {
      configLoader.create({
        registries: {
          internal: 'https://gitlab.company.com',
        },
      });

      expect(configLoader.getRegistryUrl('internal')).toBe('https://gitlab.company.com');
    });

    it('should construct URL for unknown registry', () => {
      expect(configLoader.getRegistryUrl('custom.example.com')).toBe('https://custom.example.com');
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
      expect(config.defaults?.registry).toBe('github');
    });

    it('should not overwrite existing skills.json', () => {
      // Create with custom config
      configLoader.create({
        name: 'my-project',
        skills: { 'existing-skill': 'github:user/skill@v1.0.0' },
      });

      // ensureExists should not overwrite
      configLoader.ensureExists();

      const config = configLoader.load();
      expect(config.name).toBe('my-project');
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
