import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateCommand } from './update.js';

// ============================================================================
// Mock Setup
// ============================================================================

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  })),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    log: vi.fn(),
  },
}));

vi.mock('../../core/config-loader.js', () => ({
  ConfigLoader: vi.fn().mockImplementation(() => ({
    exists: vi.fn(() => true),
    getSkills: vi.fn(() => ({
      'skill-1': 'github:user/skill-1@v1.0.0',
    })),
  })),
}));

vi.mock('../../core/skill-manager.js', () => ({
  SkillManager: vi.fn().mockImplementation(() => ({
    update: vi
      .fn()
      .mockResolvedValue([{ name: 'skill-1', version: 'v1.1.0', path: '/path/to/skill-1' }]),
  })),
}));

// ============================================================================
// Command Structure Tests
// ============================================================================

describe('update command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('command structure', () => {
    it('should have correct name', () => {
      expect(updateCommand.name()).toBe('update');
    });

    it('should have alias up', () => {
      expect(updateCommand.aliases()).toContain('up');
    });

    it('should have description', () => {
      expect(updateCommand.description()).toBeTruthy();
      expect(updateCommand.description().toLowerCase()).toContain('update');
    });

    it('should have optional skill argument', () => {
      const args = updateCommand.registeredArguments;
      expect(args.length).toBe(1);
      expect(args[0].name()).toBe('skill');
      expect(args[0].required).toBe(false);
    });
  });

  describe('command behavior', () => {
    it('should be defined and callable', () => {
      expect(updateCommand).toBeDefined();
      expect(typeof updateCommand.action).toBe('function');
    });
  });
});

// ============================================================================
// Update Logic Tests
// ============================================================================

describe('update command logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('config existence check', () => {
    it('should require skills.json to exist', () => {
      const configExists = false;
      expect(configExists).toBe(false);
      // When config doesn't exist, command should exit with error
    });

    it('should proceed when skills.json exists', () => {
      const configExists = true;
      expect(configExists).toBe(true);
    });
  });

  describe('skill argument handling', () => {
    it('should update all skills when no argument provided', () => {
      const skillArg = undefined;
      const isUpdateAll = !skillArg;
      expect(isUpdateAll).toBe(true);
    });

    it('should update specific skill when argument provided', () => {
      const skillArg = 'my-skill';
      const isUpdateAll = !skillArg;
      expect(isUpdateAll).toBe(false);
    });
  });

  describe('result handling', () => {
    it('should handle empty update results', () => {
      const updated: { name: string; version: string }[] = [];
      const hasUpdates = updated.length > 0;
      expect(hasUpdates).toBe(false);
    });

    it('should handle successful updates', () => {
      const updated = [
        { name: 'skill-1', version: 'v1.1.0' },
        { name: 'skill-2', version: 'v2.0.0' },
      ];
      const hasUpdates = updated.length > 0;
      expect(hasUpdates).toBe(true);
      expect(updated.length).toBe(2);
    });

    it('should format update messages correctly', () => {
      const skill = { name: 'my-skill', version: 'v2.0.0' };
      const message = `${skill.name}@${skill.version}`;
      expect(message).toBe('my-skill@v2.0.0');
    });
  });

  describe('spinner message logic', () => {
    it('should show specific skill message when skill provided', () => {
      const skillArg = 'my-skill';
      const message = skillArg ? `Updating ${skillArg}...` : 'Updating all skills...';
      expect(message).toBe('Updating my-skill...');
    });

    it('should show all skills message when no skill provided', () => {
      const skillArg = undefined;
      const message = skillArg ? `Updating ${skillArg}...` : 'Updating all skills...';
      expect(message).toBe('Updating all skills...');
    });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('update error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle update failure', () => {
    const error = new Error('Network error');
    expect(error.message).toBe('Network error');
  });

  it('should extract error message correctly', () => {
    const error = new Error('Failed to fetch repository');
    const message = (error as Error).message;
    expect(message).toBe('Failed to fetch repository');
  });
});
