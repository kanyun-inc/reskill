import { describe, it, expect, vi, beforeEach } from 'vitest';
import { outdatedCommand } from './outdated.js';

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
    package: vi.fn(),
    newline: vi.fn(),
    table: vi.fn(),
    log: vi.fn(),
  },
}));

vi.mock('../../core/config-loader.js', () => ({
  ConfigLoader: vi.fn().mockImplementation(() => ({
    exists: vi.fn(() => true),
    getSkills: vi.fn(() => ({
      'skill-1': 'github:user/skill-1@v1.0.0',
      'skill-2': 'github:user/skill-2@v2.0.0',
    })),
  })),
}));

vi.mock('../../core/skill-manager.js', () => ({
  SkillManager: vi.fn().mockImplementation(() => ({
    checkOutdated: vi.fn().mockResolvedValue([
      { name: 'skill-1', current: 'v1.0.0', latest: 'v1.1.0', updateAvailable: true },
      { name: 'skill-2', current: 'v2.0.0', latest: 'v2.0.0', updateAvailable: false },
    ]),
  })),
}));

describe('outdated command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('command structure', () => {
    it('should have correct name', () => {
      expect(outdatedCommand.name()).toBe('outdated');
    });

    it('should have description', () => {
      expect(outdatedCommand.description()).toBeTruthy();
    });

    it('should have --json option', () => {
      const jsonOption = outdatedCommand.options.find((o) => o.long === '--json');
      expect(jsonOption).toBeDefined();
      expect(jsonOption?.short).toBe('-j');
    });
  });

  describe('command behavior', () => {
    it('should be defined and callable', () => {
      expect(outdatedCommand).toBeDefined();
      expect(typeof outdatedCommand.action).toBe('function');
    });
  });
});

describe('outdated command with mocked config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle config not existing', async () => {
    const { ConfigLoader } = await import('../../core/config-loader.js');
    vi.mocked(ConfigLoader).mockImplementation(
      () =>
        ({
          exists: vi.fn(() => false),
          getSkills: vi.fn(() => ({})),
        }) as any
    );

    // Command would exit with error
  });

  it('should handle empty skills list', async () => {
    const { ConfigLoader } = await import('../../core/config-loader.js');
    vi.mocked(ConfigLoader).mockImplementation(
      () =>
        ({
          exists: vi.fn(() => true),
          getSkills: vi.fn(() => ({})),
        }) as any
    );
  });
});
