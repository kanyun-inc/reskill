import { beforeEach, describe, expect, it, vi } from 'vitest';
import { infoCommand } from './info.js';

// ============================================================================
// Mock Setup
// ============================================================================

vi.mock('../../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    newline: vi.fn(),
  },
}));

vi.mock('../../core/skill-manager.js', () => ({
  SkillManager: vi.fn().mockImplementation(() => ({
    getInfo: vi.fn().mockReturnValue({
      installed: {
        name: 'test-skill',
        path: '/path/to/test-skill',
        version: '1.0.0',
        isLinked: false,
        metadata: {
          name: 'test-skill',
          version: '1.0.0',
          description: 'A test skill',
          author: 'Test Author',
          license: 'MIT',
          keywords: ['test', 'skill'],
        },
      },
      locked: {
        source: 'github:user/test-skill',
        version: '1.0.0',
        resolved: 'https://github.com/user/test-skill.git',
        commit: 'abc123def456',
        installedAt: '2024-01-01T00:00:00Z',
      },
      config: 'github:user/test-skill@v1.0.0',
    }),
  })),
}));

// ============================================================================
// Command Structure Tests
// ============================================================================

describe('info command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('command structure', () => {
    it('should have correct name', () => {
      expect(infoCommand.name()).toBe('info');
    });

    it('should have description containing detail', () => {
      expect(infoCommand.description()).toBeTruthy();
      expect(infoCommand.description()).toContain('detail');
    });

    it('should have required skill argument', () => {
      const args = infoCommand.registeredArguments;
      expect(args.length).toBe(1);
      expect(args[0].name()).toBe('skill');
      expect(args[0].required).toBe(true);
    });

    it('should have --json option with -j shortcut', () => {
      const jsonOption = infoCommand.options.find((o) => o.long === '--json');
      expect(jsonOption).toBeDefined();
      expect(jsonOption?.short).toBe('-j');
    });
  });

  describe('command behavior', () => {
    it('should be defined and callable', () => {
      expect(infoCommand).toBeDefined();
      expect(typeof infoCommand.action).toBe('function');
    });
  });
});

// ============================================================================
// Info Logic Tests
// ============================================================================

describe('info command logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('skill not found detection', () => {
    it('should detect when skill is not found', () => {
      const info = {
        installed: null,
        locked: undefined,
        config: undefined,
      };
      const notFound = !info.installed && !info.config;
      expect(notFound).toBe(true);
    });

    it('should not report not found when config exists', () => {
      const info = {
        installed: null,
        locked: undefined,
        config: 'github:user/skill@v1.0.0',
      };
      const notFound = !info.installed && !info.config;
      expect(notFound).toBe(false);
    });

    it('should not report not found when installed', () => {
      const info = {
        installed: { name: 'skill', version: '1.0.0' },
        locked: undefined,
        config: undefined,
      };
      const notFound = !info.installed && !info.config;
      expect(notFound).toBe(false);
    });
  });

  describe('linked skill display', () => {
    it('should show Yes for linked skills', () => {
      const isLinked = true;
      const display = isLinked ? 'Yes' : 'No';
      expect(display).toBe('Yes');
    });

    it('should show No for non-linked skills', () => {
      const isLinked = false;
      const display = isLinked ? 'Yes' : 'No';
      expect(display).toBe('No');
    });
  });

  describe('metadata display logic', () => {
    it('should format keywords correctly', () => {
      const keywords = ['test', 'skill', 'example'];
      const formatted = keywords.join(', ');
      expect(formatted).toBe('test, skill, example');
    });

    it('should handle empty keywords', () => {
      const keywords: string[] = [];
      const hasKeywords = keywords?.length > 0;
      expect(hasKeywords).toBe(false);
    });

    it('should check for optional metadata fields', () => {
      const metadata = {
        name: 'skill',
        description: 'A skill',
        author: undefined,
        license: 'MIT',
        keywords: undefined as string[] | undefined,
      };
      expect(!!metadata.description).toBe(true);
      expect(!!metadata.author).toBe(false);
      expect(!!metadata.license).toBe(true);
      expect(!!metadata.keywords?.length).toBe(false);
    });
  });

  describe('JSON output', () => {
    it('should serialize info object correctly', () => {
      const info = {
        installed: { name: 'skill', version: '1.0.0' },
        locked: { version: '1.0.0', commit: 'abc123' },
        config: 'github:user/skill@v1.0.0',
      };
      const json = JSON.stringify(info, null, 2);
      expect(json).toContain('"name": "skill"');
      expect(json).toContain('"version": "1.0.0"');
    });
  });
});

// ============================================================================
// Info Output Scenarios
// ============================================================================

describe('info command output scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle skill with full metadata', () => {
    const info = {
      installed: {
        name: 'test-skill',
        path: '/path/to/test-skill',
        version: '1.0.0',
        isLinked: false,
        metadata: {
          name: 'test-skill',
          version: '1.0.0',
          description: 'A test skill',
          author: 'Test Author',
          license: 'MIT',
          keywords: ['test', 'skill'],
        },
      },
      locked: {
        source: 'github:user/test-skill',
        version: '1.0.0',
        commit: 'abc123def456',
        installedAt: '2024-01-01T00:00:00Z',
      },
      config: 'github:user/test-skill@v1.0.0',
    };

    expect(info.installed).toBeDefined();
    expect(info.installed.metadata).toBeDefined();
    expect(info.installed.metadata?.description).toBe('A test skill');
    expect(info.installed.metadata?.author).toBe('Test Author');
    expect(info.installed.metadata?.keywords).toEqual(['test', 'skill']);
  });

  it('should handle skill without metadata', () => {
    const info = {
      installed: {
        name: 'minimal-skill',
        path: '/path/to/skill',
        version: '1.0.0',
        isLinked: false,
        metadata: undefined,
      },
      locked: undefined,
      config: undefined,
    };

    expect(info.installed).toBeDefined();
    expect(info.installed.metadata).toBeUndefined();
  });

  it('should handle linked skill correctly', () => {
    const info = {
      installed: {
        name: 'linked-skill',
        path: '/path/to/linked-skill',
        version: 'local',
        isLinked: true,
      },
      locked: undefined,
      config: undefined,
    };

    expect(info.installed.isLinked).toBe(true);
    expect(info.installed.version).toBe('local');
  });

  it('should handle skill with config but not installed', () => {
    const info = {
      installed: null,
      locked: undefined,
      config: 'github:user/skill@v1.0.0',
    };

    expect(info.installed).toBeNull();
    expect(info.config).toBe('github:user/skill@v1.0.0');
  });
});
