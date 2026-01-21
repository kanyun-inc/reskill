/**
 * Skills Package Manager Type Definitions
 * Based on: docs/skills-management-design.md
 */

// ============================================================================
// Multi-Agent 相关类型
// ============================================================================

/**
 * 支持的 Agent 类型
 */
export type {
  AgentType,
  AgentConfig,
} from '../core/agent-registry.js';

/**
 * 安装模式
 */
export type { InstallMode, InstallResult } from '../core/installer.js';

/**
 * SKILL.md 解析相关类型 (遵循 agentskills.io 规范)
 */
export type {
  SkillMdFrontmatter,
  ParsedSkill,
} from '../core/skill-parser.js';

// ============================================================================
// skills.json - 项目依赖配置
// ============================================================================

/**
 * 版本规范格式
 * - 精确版本: @v1.0.0
 * - 最新版本: @latest
 * - 范围版本: @^2.0.0 (semver)
 * - 分支: @branch:develop
 * - Commit: @commit:abc1234
 * - 无版本: 默认使用 main/master
 */
export type VersionSpec = string;

/**
 * Skill 引用格式
 * 完整格式: <registry>:<owner>/<repo>@<version>
 * 简写格式: <owner>/<repo>@<version>
 */
export type SkillRef = string;

/**
 * Registry 配置
 */
export interface RegistryConfig {
  [name: string]: string;
}

/**
 * 默认配置
 */
export interface SkillsDefaults {
  /** 默认 registry */
  registry?: string;
  /** 安装目录，默认 .skills */
  installDir?: string;
  /** 目标 agents 列表 */
  targetAgents?: string[];
  /** 安装模式: symlink | copy */
  installMode?: 'symlink' | 'copy';
}

/**
 * Skill 覆盖配置
 */
export interface SkillOverride {
  /** 是否启用 */
  enabled?: boolean;
  /** 自定义配置 */
  config?: Record<string, unknown>;
}

/**
 * skills.json 完整 Schema
 */
export interface SkillsJson {
  /** JSON Schema 引用 */
  $schema?: string;
  /** 项目名称 */
  name?: string;
  /** 项目版本 */
  version?: string;
  /** 项目描述 */
  description?: string;
  /** Skill 依赖映射 */
  skills: Record<string, SkillRef>;
  /** Registry 配置 */
  registries?: RegistryConfig;
  /** 默认配置 */
  defaults?: SkillsDefaults;
  /** Skill 覆盖配置 */
  overrides?: Record<string, SkillOverride>;
}

// ============================================================================
// skills.lock - 版本锁定文件
// ============================================================================

/**
 * 锁定的 Skill 信息
 */
export interface LockedSkill {
  /** 来源，如 github:user/repo */
  source: string;
  /** 版本号 */
  version: string;
  /** 解析后的完整 URL */
  resolved: string;
  /** 精确的 commit hash */
  commit: string;
  /** 安装时间 */
  installedAt: string;
}

/**
 * skills.lock 完整 Schema
 */
export interface SkillsLock {
  /** Lock 文件版本 */
  lockfileVersion: number;
  /** 锁定的 skills */
  skills: Record<string, LockedSkill>;
}

// ============================================================================
// skill.json - Skill 仓库元数据
// ============================================================================

/**
 * Skill 配置项定义
 */
export interface SkillConfigDef {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  default?: unknown;
  description?: string;
}

/**
 * 仓库信息
 */
export interface SkillRepository {
  type: 'git';
  url: string;
}

/**
 * 兼容性配置
 */
export interface SkillCompatibility {
  claude?: string;
  cursor?: string;
  [platform: string]: string | undefined;
}

/**
 * skill.json 完整 Schema（Skill 仓库的元数据）
 */
export interface SkillJson {
  /** Skill 名称 */
  name: string;
  /** 版本号 */
  version: string;
  /** 描述 */
  description?: string;
  /** 作者 */
  author?: string;
  /** 许可证 */
  license?: string;
  /** 入口文件，默认 SKILL.md */
  entry?: string;
  /** 包含的文件列表 */
  files?: string[];
  /** 关键词 */
  keywords?: string[];
  /** 仓库信息 */
  repository?: SkillRepository;
  /** 可配置项 */
  config?: Record<string, SkillConfigDef>;
  /** 平台兼容性 */
  compatibility?: SkillCompatibility;
}

// ============================================================================
// 解析后的类型
// ============================================================================

/**
 * 解析后的 Skill 引用
 */
export interface ParsedSkillRef {
  /** Registry 名称，如 github, gitlab */
  registry: string;
  /** 所有者/组织 */
  owner: string;
  /** 仓库名 */
  repo: string;
  /** 子路径（如果是 monorepo） */
  subPath?: string;
  /** 版本规范 */
  version?: VersionSpec;
  /** 原始引用字符串 */
  raw: string;
  /** 完整的 Git URL (SSH/HTTPS)，如果提供的话 */
  gitUrl?: string;
}

/**
 * 版本类型
 */
export type VersionType = 
  | 'exact'    // v1.0.0
  | 'latest'   // latest
  | 'range'    // ^2.0.0, ~1.0.0
  | 'branch'   // branch:develop
  | 'commit';  // commit:abc1234

/**
 * 解析后的版本信息
 */
export interface ParsedVersion {
  type: VersionType;
  value: string;
  raw: string;
}

/**
 * 已安装的 Skill 信息
 */
export interface InstalledSkill {
  /** Skill 名称 */
  name: string;
  /** 安装路径 */
  path: string;
  /** 版本号 */
  version: string;
  /** 来源 */
  source: string;
  /** Skill 元数据 */
  metadata?: SkillJson;
  /** 是否为链接 */
  isLinked?: boolean;
}

// ============================================================================
// CLI 相关类型
// ============================================================================

/**
 * 安装选项
 */
export interface InstallOptions {
  /** 强制重新安装 */
  force?: boolean;
  /** 保存到 skills.json */
  save?: boolean;
  /** 全局安装 */
  global?: boolean;
  /** 目标 agents 列表 */
  agents?: string[];
  /** 安装模式: symlink | copy */
  mode?: 'symlink' | 'copy';
  /** 跳过确认 */
  yes?: boolean;
}

/**
 * 更新选项
 */
export interface UpdateOptions {
  /** 更新所有 */
  all?: boolean;
}

/**
 * 列表选项
 */
export interface ListOptions {
  /** JSON 格式输出 */
  json?: boolean;
}
