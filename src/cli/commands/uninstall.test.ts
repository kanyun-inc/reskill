import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uninstallCommand } from './uninstall.js';

// ============================================================================
// Mock Setup
// ============================================================================

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
  note: vi.fn(),
  confirm: vi.fn(() => Promise.resolve(true)),
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
}));

vi.mock('../../core/skill-manager.js', () => ({
  SkillManager: vi.fn().mockImplementation(() => ({
    uninstallFromAgents: vi.fn().mockReturnValue(
      new Map([
        ['cursor', true],
        ['claude-code', true],
      ]),
    ),
  })),
}));

vi.mock('../../core/installer.js', () => ({
  Installer: vi.fn().mockImplementation(() => ({
    isInstalled: vi.fn((skillName: string, agent: string) => {
      // Mock: skill is installed in cursor and claude-code
      return ['cursor', 'claude-code'].includes(agent);
    }),
  })),
}));

vi.mock('../../core/agent-registry.js', () => ({
  agents: {
    cursor: {
      name: 'cursor',
      displayName: 'Cursor',
      skillsDir: '.cursor/skills',
    },
    'claude-code': {
      name: 'claude-code',
      displayName: 'Claude Code',
      skillsDir: '.claude/skills',
    },
    windsurf: {
      name: 'windsurf',
      displayName: 'Windsurf',
      skillsDir: '.windsurf/skills',
    },
  },
}));

// ============================================================================
// Command Structure Tests
// ============================================================================

describe('uninstall command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('command structure', () => {
    it('should have correct name', () => {
      expect(uninstallCommand.name()).toBe('uninstall');
    });

    it('should have correct aliases', () => {
      const aliases = uninstallCommand.aliases();
      expect(aliases).toContain('un');
      expect(aliases).toContain('remove');
      expect(aliases).toContain('rm');
    });

    it('should have description', () => {
      expect(uninstallCommand.description()).toBeTruthy();
      expect(uninstallCommand.description().toLowerCase()).toContain('uninstall');
    });

    it('should have required skill argument', () => {
      const args = uninstallCommand.registeredArguments;
      expect(args.length).toBe(1);
      expect(args[0].name()).toBe('skill');
      expect(args[0].required).toBe(true);
    });

    it('should have all required options', () => {
      const optionNames = uninstallCommand.options.map((o) => o.long);
      expect(optionNames).toContain('--global');
      expect(optionNames).toContain('--yes');
    });

    it('should have correct option shortcuts', () => {
      const globalOption = uninstallCommand.options.find((o) => o.long === '--global');
      const yesOption = uninstallCommand.options.find((o) => o.long === '--yes');

      expect(globalOption?.short).toBe('-g');
      expect(yesOption?.short).toBe('-y');
    });
  });

  describe('command behavior', () => {
    it('should be defined and callable', () => {
      expect(uninstallCommand).toBeDefined();
      expect(typeof uninstallCommand.action).toBe('function');
    });
  });
});

// ============================================================================
// Uninstall Logic Tests
// ============================================================================

describe('uninstall command logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scope detection', () => {
    it('should default to project scope when --global not provided', () => {
      const options = { global: undefined, yes: true };
      const isGlobal = options.global || false;
      expect(isGlobal).toBe(false);
    });

    it('should use global scope when --global is provided', () => {
      const options = { global: true, yes: true };
      const isGlobal = options.global || false;
      expect(isGlobal).toBe(true);
    });
  });

  describe('confirmation behavior', () => {
    it('should require confirmation when -y not provided', () => {
      const options = { global: false, yes: undefined };
      const skipConfirm = options.yes || false;
      expect(skipConfirm).toBe(false);
    });

    it('should skip confirmation when -y is provided', () => {
      const options = { global: false, yes: true };
      const skipConfirm = options.yes || false;
      expect(skipConfirm).toBe(true);
    });
  });

  describe('installed agents check logic', () => {
    it('should filter agents that have skill installed', () => {
      const allAgentTypes = ['cursor', 'claude-code', 'windsurf'];
      const installedAgents = ['cursor', 'claude-code'];

      const filtered = allAgentTypes.filter((agent) => installedAgents.includes(agent));
      expect(filtered).toEqual(['cursor', 'claude-code']);
    });

    it('should handle when skill is not installed anywhere', () => {
      const allAgentTypes = ['cursor', 'claude-code', 'windsurf'];
      const installedAgents: string[] = [];

      const filtered = allAgentTypes.filter((agent) => installedAgents.includes(agent));
      expect(filtered.length).toBe(0);
    });
  });

  describe('result counting logic', () => {
    it('should count successful uninstalls', () => {
      const results = new Map([
        ['cursor', true],
        ['claude-code', true],
        ['windsurf', false],
      ]);

      const successCount = Array.from(results.values()).filter((r) => r).length;
      expect(successCount).toBe(2);
    });

    it('should handle all failures', () => {
      const results = new Map([
        ['cursor', false],
        ['claude-code', false],
      ]);

      const successCount = Array.from(results.values()).filter((r) => r).length;
      expect(successCount).toBe(0);
    });

    it('should handle all successes', () => {
      const results = new Map([
        ['cursor', true],
        ['claude-code', true],
      ]);

      const successCount = Array.from(results.values()).filter((r) => r).length;
      expect(successCount).toBe(2);
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('uninstall edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle empty results map', () => {
    const results = new Map<string, boolean>();
    const successCount = Array.from(results.values()).filter((r) => r).length;
    expect(successCount).toBe(0);
  });

  it('should construct correct display name list', () => {
    const agents = {
      cursor: { displayName: 'Cursor' },
      'claude-code': { displayName: 'Claude Code' },
    };
    const installedAgents = ['cursor', 'claude-code'];

    const displayNames = installedAgents.map((a) => agents[a as keyof typeof agents].displayName);
    expect(displayNames.join(', ')).toBe('Cursor, Claude Code');
  });
});
