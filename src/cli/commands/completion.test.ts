import { beforeEach, describe, expect, it, vi } from 'vitest';
import { completionCommand, maybeHandleCompletion } from './completion.js';

// ============================================================================
// Mock Setup
// ============================================================================

vi.mock('tabtab', () => ({
  default: {
    parseEnv: vi.fn(),
    log: vi.fn(),
    install: vi.fn(),
    uninstall: vi.fn(),
  },
}));

// Import the mocked module to get access to the mock functions
import tabtab from 'tabtab';

const mockTabtab = vi.mocked(tabtab);

vi.mock('../../utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    newline: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../core/skill-manager.js', () => ({
  SkillManager: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockReturnValue([
      { name: 'skill-one', version: '1.0.0' },
      { name: 'skill-two', version: '2.0.0' },
    ]),
  })),
}));

vi.mock('../../core/agent-registry.js', () => ({
  agents: {
    cursor: {
      name: 'cursor',
      displayName: 'Cursor',
    },
    'claude-code': {
      name: 'claude-code',
      displayName: 'Claude Code',
    },
    windsurf: {
      name: 'windsurf',
      displayName: 'Windsurf',
    },
  },
}));

// ============================================================================
// Command Structure Tests
// ============================================================================

describe('completion command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTabtab.parseEnv.mockReturnValue({ complete: false });
  });

  describe('command structure', () => {
    it('should have correct name', () => {
      expect(completionCommand.name()).toBe('completion');
    });

    it('should have description', () => {
      expect(completionCommand.description()).toBeTruthy();
      expect(completionCommand.description()).toContain('completion');
    });

    it('should have optional action argument', () => {
      const args = completionCommand.registeredArguments;
      expect(args.length).toBe(1);
      expect(args[0].name()).toBe('action');
      expect(args[0].required).toBe(false);
    });
  });
});

// ============================================================================
// maybeHandleCompletion Tests
// ============================================================================

describe('maybeHandleCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return false when not in completion mode', () => {
    mockTabtab.parseEnv.mockReturnValue({ complete: false });

    const result = maybeHandleCompletion();

    expect(result).toBe(false);
  });

  it('should return true and handle completion when in completion mode', () => {
    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill ',
      prev: 'reskill',
      last: '',
    });

    const result = maybeHandleCompletion();

    expect(result).toBe(true);
    expect(mockTabtab.log).toHaveBeenCalled();
  });
});

// ============================================================================
// Completion Logic Tests - Subcommand Completion
// ============================================================================

describe('completion logic - subcommands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete subcommands when only "reskill" is typed', () => {
    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill',
      prev: '',
      last: 'reskill',
    });

    maybeHandleCompletion();

    expect(mockTabtab.log).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'install' }),
        expect.objectContaining({ name: 'uninstall' }),
        expect.objectContaining({ name: 'update' }),
        expect.objectContaining({ name: 'info' }),
        expect.objectContaining({ name: 'list' }),
        expect.objectContaining({ name: 'init' }),
        expect.objectContaining({ name: 'outdated' }),
        expect.objectContaining({ name: 'completion' }),
      ]),
    );
  });

  it('should complete subcommands when typing partial command', () => {
    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill in',
      prev: 'reskill',
      last: 'in',
    });

    maybeHandleCompletion();

    expect(mockTabtab.log).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'install' })]),
    );
  });
});

// ============================================================================
// Completion Logic Tests - Skill Name Completion
// ============================================================================

describe('completion logic - skill names', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete skill names for "info" command', () => {
    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill info ',
      prev: 'info',
      last: '',
    });

    maybeHandleCompletion();

    expect(mockTabtab.log).toHaveBeenCalledWith(['skill-one', 'skill-two']);
  });

  it('should complete skill names for "uninstall" command', () => {
    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill uninstall ',
      prev: 'uninstall',
      last: '',
    });

    maybeHandleCompletion();

    expect(mockTabtab.log).toHaveBeenCalledWith(['skill-one', 'skill-two']);
  });

  it('should complete skill names for "update" command', () => {
    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill update ',
      prev: 'update',
      last: '',
    });

    maybeHandleCompletion();

    expect(mockTabtab.log).toHaveBeenCalledWith(['skill-one', 'skill-two']);
  });

  it('should not complete more skills after first argument for info', () => {
    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill info skill-one ',
      prev: 'skill-one',
      last: '',
    });

    maybeHandleCompletion();

    expect(mockTabtab.log).toHaveBeenCalledWith([]);
  });

  it('should not complete when already have multiple arguments', () => {
    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill info skill-one extra',
      prev: 'skill-one',
      last: 'extra',
    });

    maybeHandleCompletion();

    expect(mockTabtab.log).toHaveBeenCalledWith([]);
  });

  it('should handle SkillManager error gracefully', async () => {
    const { SkillManager } = await import('../../core/skill-manager.js');
    vi.mocked(SkillManager).mockImplementation(() => {
      throw new Error('Failed to load skills');
    });

    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill info ',
      prev: 'info',
      last: '',
    });

    // Should not throw, should return empty array
    expect(() => maybeHandleCompletion()).not.toThrow();
    expect(mockTabtab.log).toHaveBeenCalledWith([]);

    // Restore the mock for subsequent tests
    vi.mocked(SkillManager).mockImplementation(
      () =>
        ({
          list: vi.fn().mockReturnValue([
            { name: 'skill-one', version: '1.0.0' },
            { name: 'skill-two', version: '2.0.0' },
          ]),
        }) as any,
    );
  });
});

// ============================================================================
// Completion Logic Tests - Agent Names Completion
// ============================================================================

describe('completion logic - agent names', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete agent names after "install -a"', () => {
    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill install -a ',
      prev: '-a',
      last: '',
    });

    maybeHandleCompletion();

    expect(mockTabtab.log).toHaveBeenCalledWith(['cursor', 'claude-code', 'windsurf']);
  });

  it('should complete agent names after "install --agent"', () => {
    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill install --agent ',
      prev: '--agent',
      last: '',
    });

    maybeHandleCompletion();

    expect(mockTabtab.log).toHaveBeenCalledWith(['cursor', 'claude-code', 'windsurf']);
  });
});

// ============================================================================
// Completion Logic Tests - Install Options Completion
// ============================================================================

describe('completion logic - install options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete options when typing "-" after install', () => {
    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill install -',
      prev: 'install',
      last: '-',
    });

    maybeHandleCompletion();

    expect(mockTabtab.log).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: '-f' }),
        expect.objectContaining({ name: '--force' }),
        expect.objectContaining({ name: '-g' }),
        expect.objectContaining({ name: '--global' }),
        expect.objectContaining({ name: '-a' }),
        expect.objectContaining({ name: '--agent' }),
        expect.objectContaining({ name: '-y' }),
        expect.objectContaining({ name: '--yes' }),
        expect.objectContaining({ name: '--all' }),
      ]),
    );
  });

  it('should complete options when typing "--" after install', () => {
    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill install --',
      prev: 'install',
      last: '--',
    });

    maybeHandleCompletion();

    expect(mockTabtab.log).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: '--force' }),
        expect.objectContaining({ name: '--global' }),
      ]),
    );
  });

  it('should not complete options when not typing an option prefix', () => {
    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill install ',
      prev: 'install',
      last: '',
    });

    maybeHandleCompletion();

    expect(mockTabtab.log).toHaveBeenCalledWith([]);
  });
});

// ============================================================================
// Completion Logic Tests - Default/Edge Cases
// ============================================================================

describe('completion logic - edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty completions for unknown commands', () => {
    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill unknown ',
      prev: 'unknown',
      last: '',
    });

    maybeHandleCompletion();

    expect(mockTabtab.log).toHaveBeenCalledWith([]);
  });

  it('should return empty completions for "list" command (no args needed)', () => {
    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill list ',
      prev: 'list',
      last: '',
    });

    maybeHandleCompletion();

    expect(mockTabtab.log).toHaveBeenCalledWith([]);
  });

  it('should not call tabtab.log when not in completion mode', () => {
    mockTabtab.parseEnv.mockReturnValue({
      complete: false,
    });

    maybeHandleCompletion();

    expect(mockTabtab.log).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Command Action Tests
// ============================================================================

describe('completion command action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTabtab.parseEnv.mockReturnValue({ complete: false });
  });

  it('should show help when no action is provided', async () => {
    const { logger } = await import('../../utils/logger.js');

    // Parse and execute the command with no action
    await completionCommand.parseAsync(['node', 'test']);

    expect(logger.log).toHaveBeenCalledWith('Shell completion for reskill');
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
  });

  it('should install completion when action is "install"', async () => {
    const { logger } = await import('../../utils/logger.js');
    mockTabtab.install.mockResolvedValue(undefined);

    await completionCommand.parseAsync(['node', 'test', 'install']);

    expect(mockTabtab.install).toHaveBeenCalledWith({
      name: 'reskill',
      completer: 'reskill',
    });
    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('installed'));
  });

  it('should handle install error', async () => {
    const { logger } = await import('../../utils/logger.js');
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockTabtab.install.mockRejectedValue(new Error('Install failed'));

    await completionCommand.parseAsync(['node', 'test', 'install']);

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Install failed'));
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it('should uninstall completion when action is "uninstall"', async () => {
    const { logger } = await import('../../utils/logger.js');
    mockTabtab.uninstall.mockResolvedValue(undefined);

    await completionCommand.parseAsync(['node', 'test', 'uninstall']);

    expect(mockTabtab.uninstall).toHaveBeenCalledWith({
      name: 'reskill',
    });
    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('uninstalled'));
  });

  it('should handle uninstall error', async () => {
    const { logger } = await import('../../utils/logger.js');
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockTabtab.uninstall.mockRejectedValue(new Error('Uninstall failed'));

    await completionCommand.parseAsync(['node', 'test', 'uninstall']);

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Uninstall failed'));
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it('should show error for unknown action', async () => {
    const { logger } = await import('../../utils/logger.js');
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await completionCommand.parseAsync(['node', 'test', 'unknown']);

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown action'));
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it('should handle completion when in completion mode during action', async () => {
    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill ',
      prev: 'reskill',
      last: '',
    });

    await completionCommand.parseAsync(['node', 'test']);

    // Should call handleCompletion via the action
    expect(mockTabtab.log).toHaveBeenCalled();
  });
});

// ============================================================================
// SUBCOMMANDS Constant Tests
// ============================================================================

describe('SUBCOMMANDS constant', () => {
  it('should have all expected commands with descriptions', () => {
    // We verify this indirectly through completion
    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill',
      prev: '',
      last: 'reskill',
    });

    maybeHandleCompletion();

    const completions = mockTabtab.log.mock.calls[0][0];

    expect(completions).toHaveLength(8);

    const names = completions.map((c: { name: string }) => c.name);
    expect(names).toContain('install');
    expect(names).toContain('uninstall');
    expect(names).toContain('update');
    expect(names).toContain('info');
    expect(names).toContain('list');
    expect(names).toContain('init');
    expect(names).toContain('outdated');
    expect(names).toContain('completion');

    // Verify all have descriptions
    for (const completion of completions) {
      expect(completion.description).toBeTruthy();
    }
  });
});

// ============================================================================
// SKILL_COMPLETION_COMMANDS Tests
// ============================================================================

describe('SKILL_COMPLETION_COMMANDS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include info, uninstall, and update commands', () => {
    // Test each command that should have skill completion
    const commands = ['info', 'uninstall', 'update'];

    for (const cmd of commands) {
      vi.clearAllMocks();
      mockTabtab.parseEnv.mockReturnValue({
        complete: true,
        line: `reskill ${cmd} `,
        prev: cmd,
        last: '',
      });

      maybeHandleCompletion();

      expect(mockTabtab.log).toHaveBeenCalledWith(['skill-one', 'skill-two']);
    }
  });

  it('should not include list in skill completion commands', () => {
    mockTabtab.parseEnv.mockReturnValue({
      complete: true,
      line: 'reskill list ',
      prev: 'list',
      last: '',
    });

    maybeHandleCompletion();

    expect(mockTabtab.log).toHaveBeenCalledWith([]);
  });
});
