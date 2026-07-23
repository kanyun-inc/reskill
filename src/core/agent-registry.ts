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
 * Supported Agent types
 */
export type AgentType =
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
export const agents: Record<AgentType, AgentConfig> = {
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
 * Get all Agent type list
 */
export function getAllAgentTypes(): AgentType[] {
  return Object.keys(agents) as AgentType[];
}

/**
 * Detect installed Agents
 */
export async function detectInstalledAgents(): Promise<AgentType[]> {
  const installed: AgentType[] = [];

  for (const [type, config] of Object.entries(agents)) {
    if (await config.detectInstalled()) {
      installed.push(type as AgentType);
    }
  }

  return installed;
}

/**
 * Get Agent configuration
 */
export function getAgentConfig(type: AgentType): AgentConfig {
  return agents[type];
}

/**
 * Validate if Agent type is valid
 */
export function isValidAgentType(type: string): type is AgentType {
  return type in agents;
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
  options: { global?: boolean; cwd?: string } = {},
): string {
  const config = agents[type];
  if (type === CLAUDE_COWORK_3P_AGENT) {
    return join(resolveClaude3pSkillsRoot(), 'skills');
  }
  if (options.global) {
    return config.globalSkillsDir;
  }
  const cwd = options.cwd || process.cwd();
  return join(cwd, config.skillsDir);
}

export default agents;
