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
      expect(config.registries).toEqual({ github: 'https://github.com' });
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
    });

    it('should auto-add github registry when adding github skill', () => {
      configLoader.addSkill('my-skill', 'github:user/skill@v1.0.0');

      const content = fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8');
      const parsed = JSON.parse(content) as SkillsJson;

      expect(parsed.registries).toBeDefined();
      expect(parsed.registries?.github).toBe('https://github.com');
    });

    it('should auto-add gitlab registry when adding gitlab skill', () => {
      configLoader.addSkill('my-skill', 'gitlab:user/skill@v1.0.0');

      const content = fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8');
      const parsed = JSON.parse(content) as SkillsJson;

      expect(parsed.registries).toBeDefined();
      expect(parsed.registries?.gitlab).toBe('https://gitlab.com');
    });

    it('should auto-add multiple registries for different skills', () => {
      configLoader.addSkill('github-skill', 'github:user/skill1@v1.0.0');
      configLoader.addSkill('gitlab-skill', 'gitlab:user/skill2@v1.0.0');

      const content = fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8');
      const parsed = JSON.parse(content) as SkillsJson;

      expect(parsed.registries?.github).toBe('https://github.com');
      expect(parsed.registries?.gitlab).toBe('https://gitlab.com');
    });

    it('should not overwrite existing custom registry', () => {
      // Create config with custom github registry
      configLoader.create({
        registries: {
          github: 'https://github.mycompany.com',
        },
      });

      configLoader.addSkill('my-skill', 'github:user/skill@v1.0.0');

      const content = fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8');
      const parsed = JSON.parse(content) as SkillsJson;

      // Should keep the custom URL, not overwrite with default
      expect(parsed.registries?.github).toBe('https://github.mycompany.com');
    });

    it('should not add extra registry for URL-based skill refs', () => {
      configLoader.addSkill('my-skill', 'https://example.com/user/skill@v1.0.0');

      const content = fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8');
      const parsed = JSON.parse(content) as SkillsJson;

      // Should only have the default github registry, not add example.com
      expect(parsed.registries).toEqual({ github: 'https://github.com' });
    });
  });

  describe('getRegistryUrl', () => {
    it('should return github URL for well-known github registry', () => {
      expect(configLoader.getRegistryUrl('github')).toBe('https://github.com');
    });

    it('should return gitlab URL for well-known gitlab registry', () => {
      expect(configLoader.getRegistryUrl('gitlab')).toBe('https://gitlab.com');
    });

    it('should return custom registry URL when defined in config', () => {
      const testConfig: SkillsJson = {
        skills: {},
        registries: {
          internal: 'https://gitlab.company.com',
          enterprise: 'https://git.enterprise.io',
        },
      };
      fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify(testConfig));

      // Reload to pick up new config
      const loader = new ConfigLoader(tempDir);
      expect(loader.getRegistryUrl('internal')).toBe('https://gitlab.company.com');
      expect(loader.getRegistryUrl('enterprise')).toBe('https://git.enterprise.io');
    });

    it('should prioritize custom registry over well-known registry', () => {
      const testConfig: SkillsJson = {
        skills: {},
        registries: {
          github: 'https://github.enterprise.com', // Override well-known
        },
      };
      fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify(testConfig));

      const loader = new ConfigLoader(tempDir);
      expect(loader.getRegistryUrl('github')).toBe('https://github.enterprise.com');
    });

    it('should fallback to https:// prefix for unknown registry', () => {
      expect(configLoader.getRegistryUrl('unknown.host.com')).toBe('https://unknown.host.com');
    });

    it('should work without config file (uses defaults)', () => {
      // No config file exists
      expect(configLoader.getRegistryUrl('github')).toBe('https://github.com');
      expect(configLoader.getRegistryUrl('gitlab')).toBe('https://gitlab.com');
      expect(configLoader.getRegistryUrl('custom.host')).toBe('https://custom.host');
    });

    it('should handle config without registries section', () => {
      const testConfig: SkillsJson = {
        skills: {
          'my-skill': 'github:user/skill@v1.0.0',
        },
        // No registries section
      };
      fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify(testConfig));

      const loader = new ConfigLoader(tempDir);
      expect(loader.getRegistryUrl('github')).toBe('https://github.com');
      expect(loader.getRegistryUrl('custom')).toBe('https://custom');
    });
  });

  describe('getRegistries', () => {
    it('should return default registries when no config', () => {
      const registries = configLoader.getRegistries();
      expect(registries.github).toBe('https://github.com');
      expect(registries.gitlab).toBe('https://gitlab.com');
    });

    it('should merge custom registries with defaults', () => {
      const testConfig: SkillsJson = {
        skills: {},
        registries: {
          internal: 'https://gitlab.company.com',
        },
      };
      fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify(testConfig));

      const loader = new ConfigLoader(tempDir);
      const registries = loader.getRegistries();
      expect(registries.github).toBe('https://github.com');
      expect(registries.gitlab).toBe('https://gitlab.com');
      expect(registries.internal).toBe('https://gitlab.company.com');
    });

    it('should allow custom registries to override defaults', () => {
      const testConfig: SkillsJson = {
        skills: {},
        registries: {
          github: 'https://github.enterprise.com',
        },
      };
      fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify(testConfig));

      const loader = new ConfigLoader(tempDir);
      const registries = loader.getRegistries();
      expect(registries.github).toBe('https://github.enterprise.com');
      expect(registries.gitlab).toBe('https://gitlab.com');
    });
  });

  describe('registries in skills.json', () => {
    it('should create config with custom registries', () => {
      const config = configLoader.create({
        registries: {
          internal: 'https://gitlab.company.com',
        },
      });

      expect(config.registries?.internal).toBe('https://gitlab.company.com');

      // Verify persisted
      const loaded = JSON.parse(fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8'));
      expect(loaded.registries?.internal).toBe('https://gitlab.company.com');
    });

    it('should allow skills with custom registry prefix', () => {
      const testConfig: SkillsJson = {
        skills: {
          planning: 'github:user/planning-skill@v1.0.0',
          'internal-tool': 'internal:team/tool@latest',
        },
        registries: {
          internal: 'https://gitlab.company.com',
        },
      };
      fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify(testConfig));

      const loader = new ConfigLoader(tempDir);
      const skills = loader.getSkills();

      expect(skills.planning).toBe('github:user/planning-skill@v1.0.0');
      expect(skills['internal-tool']).toBe('internal:team/tool@latest');
      expect(loader.getRegistryUrl('internal')).toBe('https://gitlab.company.com');
    });
  });

  describe('findRegistryForUrl', () => {
    it('should find custom registry for matching URL', () => {
      const testConfig: SkillsJson = {
        skills: {},
        registries: {
          internal: 'https://gitlab.company.com',
        },
      };
      fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify(testConfig));

      const loader = new ConfigLoader(tempDir);
      expect(loader.findRegistryForUrl('https://gitlab.company.com/team/tool')).toBe('internal');
      expect(loader.findRegistryForUrl('https://gitlab.company.com/team/tool.git')).toBe(
        'internal',
      );
    });

    it('should find well-known registry for github URL', () => {
      expect(configLoader.findRegistryForUrl('https://github.com/user/repo')).toBe('github');
    });

    it('should find well-known registry for gitlab URL', () => {
      expect(configLoader.findRegistryForUrl('https://gitlab.com/group/project')).toBe('gitlab');
    });

    it('should return undefined for unknown URL', () => {
      expect(configLoader.findRegistryForUrl('https://unknown.host.com/user/repo')).toBeUndefined();
    });

    it('should prioritize custom registry over well-known', () => {
      const testConfig: SkillsJson = {
        skills: {},
        registries: {
          enterprise: 'https://github.com', // Override github
        },
      };
      fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify(testConfig));

      const loader = new ConfigLoader(tempDir);
      expect(loader.findRegistryForUrl('https://github.com/user/repo')).toBe('enterprise');
    });
  });

  describe('normalizeSkillRef', () => {
    beforeEach(() => {
      const testConfig: SkillsJson = {
        skills: {},
        registries: {
          internal: 'https://gitlab.company.com',
          enterprise: 'https://git.enterprise.io',
        },
      };
      fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify(testConfig));
    });

    it('should normalize HTTPS URL to custom registry format', () => {
      const loader = new ConfigLoader(tempDir);
      expect(loader.normalizeSkillRef('https://gitlab.company.com/team/tool@v1.0.0')).toBe(
        'internal:team/tool@v1.0.0',
      );
    });

    it('should normalize HTTPS URL with .git suffix', () => {
      const loader = new ConfigLoader(tempDir);
      expect(loader.normalizeSkillRef('https://gitlab.company.com/team/tool.git@v1.0.0')).toBe(
        'internal:team/tool@v1.0.0',
      );
    });

    it('should normalize HTTPS URL without version', () => {
      const loader = new ConfigLoader(tempDir);
      expect(loader.normalizeSkillRef('https://gitlab.company.com/team/tool')).toBe(
        'internal:team/tool',
      );
    });

    it('should normalize GitHub URL to github registry', () => {
      const loader = new ConfigLoader(tempDir);
      expect(loader.normalizeSkillRef('https://github.com/user/skill@v2.0.0')).toBe(
        'github:user/skill@v2.0.0',
      );
    });

    it('should normalize GitLab URL to gitlab registry', () => {
      const loader = new ConfigLoader(tempDir);
      expect(loader.normalizeSkillRef('https://gitlab.com/group/project@latest')).toBe(
        'gitlab:group/project@latest',
      );
    });

    it('should normalize SSH URL to registry format', () => {
      const loader = new ConfigLoader(tempDir);
      expect(loader.normalizeSkillRef('git@gitlab.company.com:team/tool.git@v1.0.0')).toBe(
        'internal:team/tool@v1.0.0',
      );
    });

    it('should normalize GitHub SSH URL', () => {
      const loader = new ConfigLoader(tempDir);
      expect(loader.normalizeSkillRef('git@github.com:user/repo.git@v1.0.0')).toBe(
        'github:user/repo@v1.0.0',
      );
    });

    it('should preserve already normalized references', () => {
      const loader = new ConfigLoader(tempDir);
      expect(loader.normalizeSkillRef('internal:team/tool@v1.0.0')).toBe(
        'internal:team/tool@v1.0.0',
      );
      expect(loader.normalizeSkillRef('github:user/repo@latest')).toBe('github:user/repo@latest');
    });

    it('should preserve unknown URLs', () => {
      const loader = new ConfigLoader(tempDir);
      expect(loader.normalizeSkillRef('https://unknown.host.com/user/repo@v1.0.0')).toBe(
        'https://unknown.host.com/user/repo@v1.0.0',
      );
    });

    it('should handle nested paths', () => {
      const loader = new ConfigLoader(tempDir);
      expect(
        loader.normalizeSkillRef('https://gitlab.company.com/team/monorepo/skills/pdf@v1.0.0'),
      ).toBe('internal:team/monorepo/skills/pdf@v1.0.0');
    });

    it('should correctly parse SSH URL with .git suffix and version', () => {
      const loader = new ConfigLoader(tempDir);
      // This tests the regex capture group fix for git@host:user/repo.git@v1.0.0
      expect(loader.normalizeSkillRef('git@github.com:user/repo.git@v1.0.0')).toBe(
        'github:user/repo@v1.0.0',
      );
    });

    it('should correctly parse SSH URL without .git suffix', () => {
      const loader = new ConfigLoader(tempDir);
      expect(loader.normalizeSkillRef('git@github.com:user/repo@v1.0.0')).toBe(
        'github:user/repo@v1.0.0',
      );
    });

    it('should correctly parse SSH URL with .git suffix but no version', () => {
      const loader = new ConfigLoader(tempDir);
      expect(loader.normalizeSkillRef('git@github.com:user/repo.git')).toBe('github:user/repo');
    });

    it('should correctly parse SSH URL without .git suffix and no version', () => {
      const loader = new ConfigLoader(tempDir);
      expect(loader.normalizeSkillRef('git@github.com:user/repo')).toBe('github:user/repo');
    });
  });
});
