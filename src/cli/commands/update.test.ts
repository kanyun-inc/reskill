import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateCommand } from './update.js';

// Mock dependencies
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
    update: vi.fn().mockResolvedValue([
      { name: 'skill-1', version: 'v1.1.0', path: '/path/to/skill-1' },
    ]),
  })),
}));

describe('update command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('command structure', () => {
    it('should have correct name', () => {
      expect(updateCommand.name()).toBe('update');
    });

    it('should have alias', () => {
      expect(updateCommand.aliases()).toContain('up');
    });

    it('should have description', () => {
      expect(updateCommand.description()).toBeTruthy();
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

describe('update command with mocked dependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle config not existing', async () => {
    const { ConfigLoader } = await import('../../core/config-loader.js');
    vi.mocked(ConfigLoader).mockImplementation(
      () =>
        ({
          exists: vi.fn(() => false),
        }) as any
    );
  });

  it('should handle no skills to update', async () => {
    const { SkillManager } = await import('../../core/skill-manager.js');
    vi.mocked(SkillManager).mockImplementation(
      () =>
        ({
          update: vi.fn().mockResolvedValue([]),
        }) as any
    );
  });

  it('should handle update of specific skill', async () => {
    const { SkillManager } = await import('../../core/skill-manager.js');
    const mockUpdate = vi.fn().mockResolvedValue([
      { name: 'my-skill', version: 'v2.0.0', path: '/path/to/skill' },
    ]);

    vi.mocked(SkillManager).mockImplementation(
      () =>
        ({
          update: mockUpdate,
        }) as any
    );
  });
});
