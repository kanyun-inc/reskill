/**
 * Tests for the `--all` flag behavior.
 *
 * `--all` must install only to agents that are actually detected on the
 * current machine. Platform-specific agents that are not present (e.g.
 * Claude Cowork 3P on Linux) must not appear in the target list, otherwise
 * they produce guaranteed "skills root not found" failures.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AgentName = 'cursor' | 'claude-code' | 'windsurf' | 'claude-cowork-3p';

const AGENT_CONFIGS = {
  cursor: { name: 'cursor', displayName: 'Cursor', skillsDir: '.cursor/skills' },
  'claude-code': { name: 'claude-code', displayName: 'Claude Code', skillsDir: '.claude/skills' },
  windsurf: { name: 'windsurf', displayName: 'Windsurf', skillsDir: '.windsurf/skills' },
  'claude-cowork-3p': {
    name: 'claude-cowork-3p',
    displayName: 'Claude Cowork 3P',
    skillsDir: '.claude-3p/skills',
  },
} as const;

const installToAgentsMock = vi.fn();
const detectInstalledAgentsMock = vi.fn();

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
    step: vi.fn(),
  },
  note: vi.fn(),
  confirm: vi.fn(() => Promise.resolve(true)),
  select: vi.fn(() => Promise.resolve('symlink')),
  multiselect: vi.fn(() => Promise.resolve(['cursor', 'claude-code'])),
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
}));

vi.mock('../../core/agent-registry.js', () => ({
  agents: AGENT_CONFIGS,
  detectInstalledAgents: detectInstalledAgentsMock,
  isValidAgentType: vi.fn((a: string) => a in AGENT_CONFIGS),
  getAgentConfig: vi.fn((a: AgentName) => AGENT_CONFIGS[a]),
}));

vi.mock('../../core/auth-manager.js', () => ({
  AuthManager: vi.fn().mockImplementation(() => ({
    getToken: vi.fn(() => undefined),
  })),
}));

vi.mock('../../core/config-loader.js', () => ({
  ConfigLoader: vi.fn().mockImplementation(() => ({
    exists: vi.fn(() => false),
    getSkills: vi.fn(() => ({})),
    getDefaults: vi.fn(() => ({
      registry: 'github',
      installDir: '.skills',
      targetAgents: [],
      installMode: undefined,
    })),
    updateDefaults: vi.fn(),
    reload: vi.fn(),
  })),
}));

vi.mock('../../core/skill-manager.js', () => ({
  SkillManager: vi.fn().mockImplementation(() => ({
    detectSkillsInRef: vi.fn().mockResolvedValue({ type: 'single' }),
    installToAgents: installToAgentsMock,
  })),
}));

vi.mock('../../utils/fs.js', async () => {
  const actual = await vi.importActual<typeof import('../../utils/fs.js')>('../../utils/fs.js');
  return { ...actual, shortenPath: vi.fn((p: string) => p) };
});

function mockInstallResults(agents: AgentName[]) {
  return new Map(
    agents.map((a) => [
      a,
      { success: true, path: `/tmp/.${a}/skills/x`, mode: 'symlink' as const },
    ]),
  );
}

describe('install --all detection behavior', () => {
  let originalExit: typeof process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    originalExit = process.exit;
    // Stub exit so that any error path inside the command does not terminate
    // the test runner. We assert on what was passed to installToAgents before
    // exit would have been called.
    process.exit = ((code?: number) => {
      throw new Error(`process.exit(${code ?? 0})`);
    }) as typeof process.exit;
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  it('only installs to detected agents (skips agents not present on this machine)', async () => {
    // Simulate a Linux machine where Claude Cowork 3P is not installed.
    detectInstalledAgentsMock.mockResolvedValue(['cursor', 'claude-code']);
    installToAgentsMock.mockResolvedValue({
      skill: { name: 'x', version: '1.0.0' },
      results: mockInstallResults(['cursor', 'claude-code']),
    });

    const { installCommand } = await import('./install.js');

    await installCommand.parseAsync(['test-skill', '--all'], { from: 'user' });

    expect(detectInstalledAgentsMock).toHaveBeenCalled();
    expect(installToAgentsMock).toHaveBeenCalledTimes(1);

    const [, targetAgents] = installToAgentsMock.mock.calls[0];
    expect(targetAgents).toEqual(['cursor', 'claude-code']);
    // The unavailable agent must not leak into the target list.
    expect(targetAgents).not.toContain('claude-cowork-3p');
    expect(targetAgents).not.toContain('windsurf');
  });

  it('falls back to all known agent types when nothing is detected', async () => {
    detectInstalledAgentsMock.mockResolvedValue([]);
    installToAgentsMock.mockResolvedValue({
      skill: { name: 'x', version: '1.0.0' },
      results: mockInstallResults([
        'cursor',
        'claude-code',
        'windsurf',
        'claude-cowork-3p',
      ]),
    });

    const { installCommand } = await import('./install.js');

    await installCommand.parseAsync(['test-skill', '--all'], { from: 'user' });

    expect(detectInstalledAgentsMock).toHaveBeenCalled();
    const [, targetAgents] = installToAgentsMock.mock.calls[0];
    // Fallback: every agent registered in the mocked registry.
    expect(new Set(targetAgents)).toEqual(
      new Set(['cursor', 'claude-code', 'windsurf', 'claude-cowork-3p']),
    );
  });

  it('surfaces detection errors and does not install', async () => {
    detectInstalledAgentsMock.mockRejectedValue(new Error('boom'));

    const { installCommand } = await import('./install.js');

    // Detection failure must abort the command before any install attempt.
    // parseAsync is wrapped in a try/catch in install.ts that calls
    // process.exit(1), which our stub re-throws.
    await expect(
      installCommand.parseAsync(['test-skill', '--all'], { from: 'user' }),
    ).rejects.toThrow(/process\.exit\(1\)/);

    expect(detectInstalledAgentsMock).toHaveBeenCalled();
    expect(installToAgentsMock).not.toHaveBeenCalled();
  });

  it('installs to the single detected agent without prompting', async () => {
    // Only Cursor is installed — --all must pick exactly that one.
    detectInstalledAgentsMock.mockResolvedValue(['cursor']);
    installToAgentsMock.mockResolvedValue({
      skill: { name: 'x', version: '1.0.0' },
      results: mockInstallResults(['cursor']),
    });

    const { installCommand } = await import('./install.js');

    await installCommand.parseAsync(['test-skill', '--all'], { from: 'user' });

    const [, targetAgents] = installToAgentsMock.mock.calls[0];
    expect(targetAgents).toEqual(['cursor']);
  });
});
