import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type AgentType,
  agents,
  buildCustomAgentConfig,
  type CustomAgentMap,
  detectInstalledAgents,
  getAgentConfig,
  getAgentSkillsDir,
  getAllAgentTypes,
  isValidAgentType,
} from './agent-registry.js';
import { CLAUDE_3P_SKILLS_ROOT_ENV } from './claude-3p-installer.js';

describe('agent-registry', () => {
  const originalClaude3pRoot = process.env[CLAUDE_3P_SKILLS_ROOT_ENV];

  afterEach(() => {
    if (originalClaude3pRoot === undefined) {
      delete process.env[CLAUDE_3P_SKILLS_ROOT_ENV];
    } else {
      process.env[CLAUDE_3P_SKILLS_ROOT_ENV] = originalClaude3pRoot;
    }
  });

  describe('agents config', () => {
    it('should have 18 agents defined', () => {
      const agentKeys = Object.keys(agents);
      expect(agentKeys.length).toBe(18);
    });

    it('should have all expected agents', () => {
      const expectedAgents: AgentType[] = [
        'amp',
        'antigravity',
        'claude-code',
        'claude-cowork-3p',
        'clawdbot',
        'codex',
        'cursor',
        'droid',
        'gemini-cli',
        'github-copilot',
        'goose',
        'kilo',
        'kiro-cli',
        'opencode',
        'roo',
        'trae',
        'windsurf',
        'neovate',
      ];

      for (const agent of expectedAgents) {
        expect(agents[agent]).toBeDefined();
        expect(agents[agent].name).toBe(agent);
        expect(agents[agent].displayName).toBeTruthy();
        expect(agents[agent].skillsDir).toBeTruthy();
        expect(agents[agent].globalSkillsDir).toBeTruthy();
        expect(typeof agents[agent].detectInstalled).toBe('function');
      }
    });

    it('should have project-level skillsDir as relative paths', () => {
      for (const [_key, config] of Object.entries(agents)) {
        // skillsDir should be relative (not starting with /)
        expect(config.skillsDir).not.toMatch(/^\//);
      }
    });

    it('should have global skillsDir as absolute paths', () => {
      const home = os.homedir();
      for (const [_key, config] of Object.entries(agents)) {
        // globalSkillsDir should be absolute (starting with home dir)
        expect(config.globalSkillsDir).toMatch(/^\//);
        expect(config.globalSkillsDir.startsWith(home)).toBe(true);
      }
    });

    it('cursor agent should have correct configuration', () => {
      const home = os.homedir();
      expect(agents.cursor.name).toBe('cursor');
      expect(agents.cursor.displayName).toBe('Cursor');
      expect(agents.cursor.skillsDir).toBe('.cursor/skills');
      expect(agents.cursor.globalSkillsDir).toBe(path.join(home, '.cursor/skills'));
    });

    it('claude-code agent should have correct configuration', () => {
      const home = os.homedir();
      expect(agents['claude-code'].name).toBe('claude-code');
      expect(agents['claude-code'].displayName).toBe('Claude Code');
      expect(agents['claude-code'].skillsDir).toBe('.claude/skills');
      expect(agents['claude-code'].globalSkillsDir).toBe(path.join(home, '.claude/skills'));
    });

    it('claude-cowork-3p agent should have correct configuration', () => {
      expect(agents['claude-cowork-3p'].name).toBe('claude-cowork-3p');
      expect(agents['claude-cowork-3p'].displayName).toBe('Claude Cowork 3P');
      expect(agents['claude-cowork-3p'].skillsDir).toBe('.claude-3p/skills');
      expect(agents['claude-cowork-3p'].globalSkillsDir).toContain(
        path.join('Claude-3p', 'local-agent-mode-sessions', 'skills-plugin'),
      );
    });

    it('github-copilot agent should have correct configuration', () => {
      const home = os.homedir();
      expect(agents['github-copilot'].name).toBe('github-copilot');
      expect(agents['github-copilot'].displayName).toBe('GitHub Copilot');
      expect(agents['github-copilot'].skillsDir).toBe('.github/skills');
      // Note: global path is .copilot, not .github
      expect(agents['github-copilot'].globalSkillsDir).toBe(path.join(home, '.copilot/skills'));
    });

    it('codex agent should have correct configuration', () => {
      const home = os.homedir();
      expect(agents.codex.name).toBe('codex');
      expect(agents.codex.displayName).toBe('Codex');
      // Latest Codex discovers project-level skills from .agents/skills
      expect(agents.codex.skillsDir).toBe('.agents/skills');
      // Global path stays under ~/.codex/skills
      expect(agents.codex.globalSkillsDir).toBe(path.join(home, '.codex/skills'));
    });

    it('windsurf agent should have correct configuration', () => {
      const home = os.homedir();
      expect(agents.windsurf.name).toBe('windsurf');
      expect(agents.windsurf.displayName).toBe('Windsurf');
      expect(agents.windsurf.skillsDir).toBe('.windsurf/skills');
      // Note: global path is .codeium/windsurf
      expect(agents.windsurf.globalSkillsDir).toBe(path.join(home, '.codeium/windsurf/skills'));
    });
  });

  describe('isValidAgentType', () => {
    it('should return true for valid agent types', () => {
      expect(isValidAgentType('cursor')).toBe(true);
      expect(isValidAgentType('claude-code')).toBe(true);
      expect(isValidAgentType('claude-cowork-3p')).toBe(true);
      expect(isValidAgentType('github-copilot')).toBe(true);
      expect(isValidAgentType('windsurf')).toBe(true);
      expect(isValidAgentType('amp')).toBe(true);
      expect(isValidAgentType('goose')).toBe(true);
    });

    it('should return false for invalid agent types', () => {
      expect(isValidAgentType('invalid')).toBe(false);
      expect(isValidAgentType('')).toBe(false);
      expect(isValidAgentType('CURSOR')).toBe(false);
      expect(isValidAgentType('Cursor')).toBe(false);
      expect(isValidAgentType('vscode')).toBe(false);
    });
  });

  describe('getAgentConfig', () => {
    it('should return config for valid agent', () => {
      const config = getAgentConfig('cursor');
      expect(config).toBeDefined();
      expect(config.name).toBe('cursor');
      expect(config.displayName).toBe('Cursor');
    });

    it('should return config for all agents', () => {
      const allTypes = getAllAgentTypes();
      for (const type of allTypes) {
        const config = getAgentConfig(type);
        expect(config).toBeDefined();
        expect(config.name).toBe(type);
      }
    });
  });

  describe('getAllAgentTypes', () => {
    it('should return array of all agent types', () => {
      const types = getAllAgentTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBe(18);
      expect(types).toContain('cursor');
      expect(types).toContain('claude-code');
      expect(types).toContain('claude-cowork-3p');
      expect(types).toContain('github-copilot');
    });
  });

  describe('getAgentSkillsDir', () => {
    it('should return project-level path by default', () => {
      const cwd = process.cwd();
      const skillsDir = getAgentSkillsDir('cursor');
      expect(skillsDir).toBe(path.join(cwd, '.cursor/skills'));
    });

    it('should return project-level path with custom cwd', () => {
      const customCwd = '/custom/path';
      const skillsDir = getAgentSkillsDir('cursor', { cwd: customCwd });
      expect(skillsDir).toBe(path.join(customCwd, '.cursor/skills'));
    });

    it('should return global path when global option is true', () => {
      const home = os.homedir();
      const skillsDir = getAgentSkillsDir('cursor', { global: true });
      expect(skillsDir).toBe(path.join(home, '.cursor/skills'));
    });

    it('should work for different agents', () => {
      const home = os.homedir();
      expect(getAgentSkillsDir('claude-code', { global: true })).toBe(
        path.join(home, '.claude/skills'),
      );
      expect(getAgentSkillsDir('windsurf', { global: true })).toBe(
        path.join(home, '.codeium/windsurf/skills'),
      );
      expect(getAgentSkillsDir('codex')).toBe(path.join(process.cwd(), '.agents/skills'));
      expect(getAgentSkillsDir('codex', { global: true })).toBe(path.join(home, '.codex/skills'));
    });

    it('should return Claude Cowork 3P app-managed skills directory', () => {
      const tempDir = mkdtempSync(path.join(os.tmpdir(), 'claude-3p-agent-registry-test-'));
      const skillsRoot = path.join(tempDir, 'skills-plugin', 'org', 'account');
      mkdirSync(path.join(skillsRoot, 'skills'), { recursive: true });
      writeFileSync(path.join(skillsRoot, 'manifest.json'), '{"skills":[]}\n');
      process.env[CLAUDE_3P_SKILLS_ROOT_ENV] = skillsRoot;

      try {
        expect(getAgentSkillsDir('claude-cowork-3p')).toBe(path.join(skillsRoot, 'skills'));
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('detectInstalledAgents', () => {
    // Note: These tests rely on actual filesystem state
    // In a real test environment, you would mock fs.existsSync

    it('should return an array', async () => {
      const installed = await detectInstalledAgents();
      expect(Array.isArray(installed)).toBe(true);
    });

    it('should only return valid agent types', async () => {
      const installed = await detectInstalledAgents();
      for (const agent of installed) {
        expect(isValidAgentType(agent)).toBe(true);
      }
    });
  });

  describe('custom agents', () => {
    const home = os.homedir();
    const custom: CustomAgentMap = {
      'cc-switch': { path: '.cc-switch/skills', globalPath: '~/.cc-switch/skills' },
      'proj-only': { path: '.tool/skills' },
    };

    describe('buildCustomAgentConfig', () => {
      it('should map path to skillsDir and expand ~ in globalPath', () => {
        const config = buildCustomAgentConfig('cc-switch', custom['cc-switch']);
        expect(config.name).toBe('cc-switch');
        expect(config.displayName).toBe('cc-switch');
        expect(config.skillsDir).toBe('.cc-switch/skills');
        expect(config.globalSkillsDir).toBe(path.join(home, '.cc-switch/skills'));
      });

      it('should use displayName when provided', () => {
        const config = buildCustomAgentConfig('x', { path: '.x/skills', displayName: 'My X' });
        expect(config.displayName).toBe('My X');
      });

      it('should leave globalSkillsDir empty when globalPath is absent', () => {
        const config = buildCustomAgentConfig('proj-only', custom['proj-only']);
        expect(config.globalSkillsDir).toBe('');
      });

      it('should always report as installed', async () => {
        const config = buildCustomAgentConfig('x', { path: '.x/skills' });
        expect(await config.detectInstalled()).toBe(true);
      });
    });

    describe('isValidAgentType with custom', () => {
      it('should accept a custom alias when passed the map', () => {
        expect(isValidAgentType('cc-switch', custom)).toBe(true);
      });

      it('should reject a custom alias when no map is passed', () => {
        expect(isValidAgentType('cc-switch')).toBe(false);
      });

      it('should still accept built-in agents', () => {
        expect(isValidAgentType('claude-code', custom)).toBe(true);
      });
    });

    describe('getAgentConfig with custom', () => {
      it('should resolve a custom agent', () => {
        expect(getAgentConfig('cc-switch', custom).skillsDir).toBe('.cc-switch/skills');
      });

      it('should throw for an unknown agent', () => {
        expect(() => getAgentConfig('nope', custom)).toThrow(/Unknown agent type/);
      });
    });

    describe('getAgentSkillsDir with custom', () => {
      it('should resolve a project-level custom directory', () => {
        const dir = getAgentSkillsDir('cc-switch', { cwd: '/proj', custom });
        expect(dir).toBe(path.join('/proj', '.cc-switch/skills'));
      });

      it('should resolve a global custom directory', () => {
        const dir = getAgentSkillsDir('cc-switch', { global: true, custom });
        expect(dir).toBe(path.join(home, '.cc-switch/skills'));
      });

      it('should throw for global install without globalPath', () => {
        expect(() => getAgentSkillsDir('proj-only', { global: true, custom })).toThrow(
          /no globalPath configured/,
        );
      });
    });

    describe('getAllAgentTypes with custom', () => {
      it('should append custom aliases', () => {
        const all = getAllAgentTypes(custom);
        expect(all).toContain('cc-switch');
        expect(all).toContain('proj-only');
        expect(all.length).toBe(Object.keys(agents).length + 2);
      });
    });

    describe('detectInstalledAgents with custom', () => {
      it('should always include custom aliases', async () => {
        const installed = await detectInstalledAgents(custom);
        expect(installed).toContain('cc-switch');
        expect(installed).toContain('proj-only');
      });
    });
  });
});
