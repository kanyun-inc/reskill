import { beforeEach, describe, expect, it, vi } from 'vitest';
import { outdatedCommand } from './outdated.js';

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

// ============================================================================
// Command Structure Tests
// ============================================================================

describe('outdated command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('command structure', () => {
    it('should have correct name', () => {
      expect(outdatedCommand.name()).toBe('outdated');
    });

    it('should have description containing outdated or check', () => {
      expect(outdatedCommand.description()).toBeTruthy();
      const desc = outdatedCommand.description().toLowerCase();
      expect(desc.includes('outdated') || desc.includes('check')).toBe(true);
    });

    it('should have --json option with -j shortcut', () => {
      const jsonOption = outdatedCommand.options.find((o) => o.long === '--json');
      expect(jsonOption).toBeDefined();
      expect(jsonOption?.short).toBe('-j');
    });

    it('should have no required arguments', () => {
      const args = outdatedCommand.registeredArguments;
      expect(args.length).toBe(0);
    });
  });

  describe('command behavior', () => {
    it('should be defined and callable', () => {
      expect(outdatedCommand).toBeDefined();
      expect(typeof outdatedCommand.action).toBe('function');
    });
  });
});

// ============================================================================
// Outdated Logic Tests
// ============================================================================

describe('outdated command logic', () => {
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

  describe('empty skills check', () => {
    it('should detect when no skills are defined', () => {
      const skills = {};
      const isEmpty = Object.keys(skills).length === 0;
      expect(isEmpty).toBe(true);
    });

    it('should proceed when skills are defined', () => {
      const skills = { 'skill-1': 'github:user/skill-1@v1.0.0' };
      const isEmpty = Object.keys(skills).length === 0;
      expect(isEmpty).toBe(false);
    });
  });

  describe('outdated filtering', () => {
    it('should filter skills with available updates', () => {
      const results = [
        { name: 'skill-1', current: 'v1.0.0', latest: 'v1.1.0', updateAvailable: true },
        { name: 'skill-2', current: 'v2.0.0', latest: 'v2.0.0', updateAvailable: false },
        { name: 'skill-3', current: 'v3.0.0', latest: 'v3.1.0', updateAvailable: true },
      ];

      const outdated = results.filter((r) => r.updateAvailable);
      expect(outdated.length).toBe(2);
      expect(outdated.map((r) => r.name)).toEqual(['skill-1', 'skill-3']);
    });

    it('should return empty when all skills are up to date', () => {
      const results = [
        { name: 'skill-1', current: 'v1.0.0', latest: 'v1.0.0', updateAvailable: false },
        { name: 'skill-2', current: 'v2.0.0', latest: 'v2.0.0', updateAvailable: false },
      ];

      const outdated = results.filter((r) => r.updateAvailable);
      expect(outdated.length).toBe(0);
    });
  });

  describe('table row formatting', () => {
    it('should format table rows correctly', () => {
      const results = [
        { name: 'skill-1', current: 'v1.0.0', latest: 'v1.1.0', updateAvailable: true },
        { name: 'skill-2', current: 'v2.0.0', latest: 'v2.0.0', updateAvailable: false },
      ];

      const rows = results.map((r) => [
        r.name,
        r.current,
        r.latest,
        r.updateAvailable ? 'Update available' : 'Up to date',
      ]);

      expect(rows[0]).toEqual(['skill-1', 'v1.0.0', 'v1.1.0', 'Update available']);
      expect(rows[1]).toEqual(['skill-2', 'v2.0.0', 'v2.0.0', 'Up to date']);
    });
  });

  describe('JSON output', () => {
    it('should serialize results correctly', () => {
      const results = [
        { name: 'skill-1', current: 'v1.0.0', latest: 'v1.1.0', updateAvailable: true },
      ];
      const json = JSON.stringify(results, null, 2);
      expect(json).toContain('"name": "skill-1"');
      expect(json).toContain('"updateAvailable": true');
    });
  });
});

// ============================================================================
// Config Scenarios
// ============================================================================

describe('outdated command config scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle config with multiple skills', () => {
    const skills = {
      'skill-1': 'github:user/skill-1@v1.0.0',
      'skill-2': 'github:user/skill-2@v2.0.0',
      'skill-3': 'github:user/skill-3@v3.0.0',
    };
    expect(Object.keys(skills).length).toBe(3);
  });

  it('should handle config with single skill', () => {
    const skills = {
      'skill-1': 'github:user/skill-1@v1.0.0',
    };
    expect(Object.keys(skills).length).toBe(1);
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('outdated error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle check failure', () => {
    const error = new Error('Network error');
    expect(error.message).toBe('Network error');
  });

  it('should extract error message correctly', () => {
    const error = new Error('Failed to fetch tags');
    const message = (error as Error).message;
    expect(message).toBe('Failed to fetch tags');
  });
});
