/**
 * Agent Registry - 多 Agent 配置定义
 *
 * 支持 17 个 coding agents 的全局和项目级安装
 * 参考: https://github.com/vercel-labs/add-skill
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * 支持的 Agent 类型
 */
export type AgentType =
  | 'amp'
  | 'antigravity'
  | 'claude-code'
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
 * Agent 配置接口
 */
export interface AgentConfig {
  /** Agent 标识符 */
  name: AgentType;
  /** 显示名称 */
  displayName: string;
  /** 项目级 skills 目录 (相对路径) */
  skillsDir: string;
  /** 全局 skills 目录 (绝对路径) */
  globalSkillsDir: string;
  /** 检测 agent 是否已安装 */
  detectInstalled: () => Promise<boolean>;
}

const home = homedir();

/**
 * 所有支持的 Agents 配置
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
        existsSync(join(process.cwd(), '.agent')) ||
        existsSync(join(home, '.gemini/antigravity'))
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
    skillsDir: '.codex/skills',
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
      return (
        existsSync(join(process.cwd(), '.github')) ||
        existsSync(join(home, '.copilot'))
      );
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
      return (
        existsSync(join(home, '.config/opencode')) ||
        existsSync(join(home, '.claude/skills'))
      );
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
 * 获取所有 Agent 类型列表
 */
export function getAllAgentTypes(): AgentType[] {
  return Object.keys(agents) as AgentType[];
}

/**
 * 检测已安装的 Agents
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
 * 获取 Agent 配置
 */
export function getAgentConfig(type: AgentType): AgentConfig {
  return agents[type];
}

/**
 * 验证 Agent 类型是否有效
 */
export function isValidAgentType(type: string): type is AgentType {
  return type in agents;
}

/**
 * 获取 Agent 的项目级 skills 目录
 */
export function getAgentSkillsDir(
  type: AgentType,
  options: { global?: boolean; cwd?: string } = {}
): string {
  const config = agents[type];
  if (options.global) {
    return config.globalSkillsDir;
  }
  const cwd = options.cwd || process.cwd();
  return join(cwd, config.skillsDir);
}

export default agents;
