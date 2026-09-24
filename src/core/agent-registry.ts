/**
 * Agent Registry - Multi-Agent configuration definitions
 *
 * Supports global and project-level installation for 18 coding agents
 * Reference: https://github.com/vercel-labs/add-skill
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  CLAUDE_COWORK_3P_AGENT,
  getClaude3pSkillsPluginBase,
  resolveClaude3pSkillsRoot,
} from './claude-3p-installer.js';

/**
 * Built-in Agent types
 */
export type BuiltinAgentType =
  | 'amp'
  | 'antigravity'
  | 'claude-code'
  | 'claude-cowork-3p'
  | 'clawdbot'
  | 'codex'
  | 'cursor'
  | 'droid'
  | 'gemini-cli'
  | 'github-copilot'
  | 'goose'
  | 'kilo'
  | 'kiro-cli'
  | 'opencode'
  | 'roo'
  | 'trae'
  | 'windsurf'
  | 'neovate';

/**
 * Agent type identifier.
 *
 * Accepts the built-in agents (with editor autocompletion via the literal
 * union) as well as arbitrary custom agent aliases defined in skills.json.
 * The `string & {}` branch keeps the literal suggestions while still allowing
 * any user-defined alias to type-check.
 */
export type AgentType = BuiltinAgentType | (string & {});

/**
 * Custom agent configuration as declared in skills.json.
 */
export interface CustomAgentConfig {
  /** Project-level skills directory (relative to project root) */
  path: string;
  /** Global skills directory (absolute; supports `~` for the home directory) */
  globalPath?: string;
  /** Optional display name; defaults to the alias */
  displayName?: string;
}

/**
 * Map of custom agent alias -> configuration.
 */
export type CustomAgentMap = Record<string, CustomAgentConfig>;

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  /** Agent identifier */
  name: AgentType;
  /** Display name */
  displayName: string;
  /** Project-level skills directory (relative path) */
  skillsDir: string;
  /** Global skills directory (absolute path) */
  globalSkillsDir: string;
  /** Detect if agent is installed */
  detectInstalled: () => Promise<boolean>;
}

const home = homedir();

/**
 * All supported Agents configuration
 */
export const agents: Record<BuiltinAgentType, AgentConfig> = {
  amp: {
    name: 'amp',
    displayName: 'Amp',
    skillsDir: '.agents/skills',
    globalSkillsDir: join(home, '.config/agents/skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.config/amp'));
    },
  },
  antigravity: {
    name: 'antigravity',
    displayName: 'Antigravity',
    skillsDir: '.agent/skills',
    globalSkillsDir: join(home, '.gemini/antigravity/skills'),
    detectInstalled: async () => {
      return (
        existsSync(join(process.cwd(), '.agent')) || existsSync(join(home, '.gemini/antigravity'))
      );
    },
  },
  'claude-code': {
    name: 'claude-code',
    displayName: 'Claude Code',
    skillsDir: '.claude/skills',
    globalSkillsDir: join(home, '.claude/skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.claude'));
    },
  },
  [CLAUDE_COWORK_3P_AGENT]: {
    name: CLAUDE_COWORK_3P_AGENT,
    displayName: 'Claude Cowork 3P',
    skillsDir: '.claude-3p/skills',
    globalSkillsDir: getClaude3pSkillsPluginBase(),
    detectInstalled: async () => {
      try {
        resolveClaude3pSkillsRoot();
        return true;
      } catch {
        return false;
      }
    },
  },
  clawdbot: {
    name: 'clawdbot',
    displayName: 'Clawdbot',
    skillsDir: 'skills',
    globalSkillsDir: join(home, '.clawdbot/skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.clawdbot'));
    },
  },
  codex: {
    name: 'codex',
    displayName: 'Codex',
    // Latest Codex discovers project-level skills from .agents/skills
    skillsDir: '.agents/skills',
    globalSkillsDir: join(home, '.codex/skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.codex'));
    },
  },
  cursor: {
    name: 'cursor',
    displayName: 'Cursor',
    skillsDir: '.cursor/skills',
    globalSkillsDir: join(home, '.cursor/skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.cursor'));
    },
  },
  droid: {
    name: 'droid',
    displayName: 'Droid',
    skillsDir: '.factory/skills',
    globalSkillsDir: join(home, '.factory/skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.factory/skills'));
    },
  },
  'gemini-cli': {
    name: 'gemini-cli',
    displayName: 'Gemini CLI',
    skillsDir: '.gemini/skills',
    globalSkillsDir: join(home, '.gemini/skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.gemini'));
    },
  },
  'github-copilot': {
    name: 'github-copilot',
    displayName: 'GitHub Copilot',
    skillsDir: '.github/skills',
    globalSkillsDir: join(home, '.copilot/skills'),
    detectInstalled: async () => {
      return existsSync(join(process.cwd(), '.github')) || existsSync(join(home, '.copilot'));
    },
  },
  goose: {
    name: 'goose',
    displayName: 'Goose',
    skillsDir: '.goose/skills',
    globalSkillsDir: join(home, '.config/goose/skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.config/goose'));
    },
  },
  kilo: {
    name: 'kilo',
    displayName: 'Kilo Code',
    skillsDir: '.kilocode/skills',
    globalSkillsDir: join(home, '.kilocode/skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.kilocode'));
    },
  },
  'kiro-cli': {
    name: 'kiro-cli',
    displayName: 'Kiro CLI',
    skillsDir: '.kiro/skills',
    globalSkillsDir: join(home, '.kiro/skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.kiro'));
    },
  },
  opencode: {
    name: 'opencode',
    displayName: 'OpenCode',
    skillsDir: '.opencode/skills',
    globalSkillsDir: join(home, '.config/opencode/skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.config/opencode')) || existsSync(join(home, '.claude/skills'));
    },
  },
  roo: {
    name: 'roo',
    displayName: 'Roo Code',
    skillsDir: '.roo/skills',
    globalSkillsDir: join(home, '.roo/skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.roo'));
    },
  },
  trae: {
    name: 'trae',
    displayName: 'Trae',
    skillsDir: '.trae/skills',
    globalSkillsDir: join(home, '.trae/skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.trae'));
    },
  },
  windsurf: {
    name: 'windsurf',
    displayName: 'Windsurf',
    skillsDir: '.windsurf/skills',
    globalSkillsDir: join(home, '.codeium/windsurf/skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.codeium/windsurf'));
    },
  },
  neovate: {
    name: 'neovate',
    displayName: 'Neovate',
    skillsDir: '.neovate/skills',
    globalSkillsDir: join(home, '.neovate/skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.neovate'));
    },
  },
};

/**
 * Expand a leading `~` to the user's home directory.
 */
function expandHome(p: string): string {
  if (p === '~') {
    return home;
  }
  if (p.startsWith('~/')) {
    return join(home, p.slice(2));
  }
  return p;
}

/**
 * Build an AgentConfig from a custom agent declaration.
 *
 * Custom agents reuse the same AgentConfig shape as built-ins, so all
 * downstream path resolution works unchanged. `globalSkillsDir` is only
 * available when the declaration provides `globalPath`; consumers must guard
 * global installs when it is empty.
 */
export function buildCustomAgentConfig(name: string, cfg: CustomAgentConfig): AgentConfig {
  return {
    name,
    displayName: cfg.displayName ?? name,
    skillsDir: cfg.path,
    globalSkillsDir: cfg.globalPath ? expandHome(cfg.globalPath) : '',
    detectInstalled: async () => true,
  };
}

/**
 * Get all Agent type list, including custom agents when provided.
 */
export function getAllAgentTypes(custom?: CustomAgentMap): AgentType[] {
  const builtin = Object.keys(agents) as AgentType[];
  if (!custom) {
    return builtin;
  }
  return [...builtin, ...Object.keys(custom)];
}

/**
 * Detect installed Agents. Custom agents are always considered installed,
 * since their target directory is declared explicitly by the user.
 */
export async function detectInstalledAgents(custom?: CustomAgentMap): Promise<AgentType[]> {
  const installed: AgentType[] = [];

  for (const [type, config] of Object.entries(agents)) {
    if (await config.detectInstalled()) {
      installed.push(type as AgentType);
    }
  }

  if (custom) {
    installed.push(...Object.keys(custom));
  }

  return installed;
}

/**
 * Get Agent configuration.
 *
 * Resolves built-in agents first, then custom agents from the provided map.
 * Throws when the type is neither built-in nor a known custom agent.
 */
export function getAgentConfig(type: AgentType, custom?: CustomAgentMap): AgentConfig {
  if (type in agents) {
    return agents[type as BuiltinAgentType];
  }
  const customCfg = custom?.[type];
  if (customCfg) {
    return buildCustomAgentConfig(type, customCfg);
  }
  throw new Error(`Unknown agent type: "${type}"`);
}

/**
 * Validate if Agent type is valid (built-in or a known custom agent).
 */
export function isValidAgentType(type: string, custom?: CustomAgentMap): boolean {
  return type in agents || (custom ? type in custom : false);
}

/**
 * Get Agent's project-level skills directory
 *
 * Claude Cowork 3P stores skills under an app-managed account directory. This
 * throws when that directory cannot be resolved, for example when the app has
 * not initialized skills or multiple local account roots exist.
 */
export function getAgentSkillsDir(
  type: AgentType,
  options: { global?: boolean; cwd?: string; custom?: CustomAgentMap } = {},
): string {
  if (type === CLAUDE_COWORK_3P_AGENT) {
    return join(resolveClaude3pSkillsRoot(), 'skills');
  }
  const config = getAgentConfig(type, options.custom);
  if (options.global) {
    if (!config.globalSkillsDir) {
      throw new Error(
        `Custom agent "${type}" has no globalPath configured; cannot install globally`,
      );
    }
    return config.globalSkillsDir;
  }
  const cwd = options.cwd || process.cwd();
  return join(cwd, config.skillsDir);
}

export default agents;
