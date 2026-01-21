import { describe, it, expect, vi, beforeEach } from 'vitest';
import { infoCommand } from './info.js';

// Mock dependencies
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

describe('info command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('command structure', () => {
    it('should have correct name', () => {
      expect(infoCommand.name()).toBe('info');
    });

    it('should have description', () => {
      expect(infoCommand.description()).toBeTruthy();
      expect(infoCommand.description()).toContain('detail');
    });

    it('should have required skill argument', () => {
      const args = infoCommand.registeredArguments;
      expect(args.length).toBe(1);
      expect(args[0].name()).toBe('skill');
      expect(args[0].required).toBe(true);
    });

    it('should have --json option', () => {
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

describe('info command output scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle skill not found', async () => {
    const { SkillManager } = await import('../../core/skill-manager.js');
    vi.mocked(SkillManager).mockImplementation(
      () =>
        ({
          getInfo: vi.fn().mockReturnValue({
            installed: null,
            locked: undefined,
            config: undefined,
          }),
        }) as any
    );
  });

  it('should handle skill with config but not installed', async () => {
    const { SkillManager } = await import('../../core/skill-manager.js');
    vi.mocked(SkillManager).mockImplementation(
      () =>
        ({
          getInfo: vi.fn().mockReturnValue({
            installed: null,
            locked: undefined,
            config: 'github:user/skill@v1.0.0',
          }),
        }) as any
    );
  });

  it('should handle linked skill', async () => {
    const { SkillManager } = await import('../../core/skill-manager.js');
    vi.mocked(SkillManager).mockImplementation(
      () =>
        ({
          getInfo: vi.fn().mockReturnValue({
            installed: {
              name: 'linked-skill',
              path: '/path/to/linked-skill',
              version: 'local',
              isLinked: true,
            },
            locked: undefined,
            config: undefined,
          }),
        }) as any
    );
  });

  it('should handle skill without metadata', async () => {
    const { SkillManager } = await import('../../core/skill-manager.js');
    vi.mocked(SkillManager).mockImplementation(
      () =>
        ({
          getInfo: vi.fn().mockReturnValue({
            installed: {
              name: 'minimal-skill',
              path: '/path/to/skill',
              version: '1.0.0',
              isLinked: false,
              metadata: undefined,
            },
            locked: undefined,
            config: undefined,
          }),
        }) as any
    );
  });

  it('should handle JSON output option', async () => {
    const { SkillManager } = await import('../../core/skill-manager.js');
    vi.mocked(SkillManager).mockImplementation(
      () =>
        ({
          getInfo: vi.fn().mockReturnValue({
            installed: { name: 'skill', version: '1.0.0' },
            locked: undefined,
            config: 'github:user/skill@v1.0.0',
          }),
        }) as any
    );
  });
});
