/**
 * reskill - AI Skills Package Manager
 *
 * Git-based skills management for AI agents
 * Supports 17+ coding agents: Cursor, Claude Code, GitHub Copilot, etc.
 */

// Core exports
export {
  GitResolver,
  CacheManager,
  ConfigLoader,
  LockManager,
  SkillManager,
  DEFAULT_REGISTRIES,
  // Multi-Agent 支持
  agents,
  detectInstalledAgents,
  getAgentConfig,
  getAllAgentTypes,
  isValidAgentType,
  getAgentSkillsDir,
  Installer,
  // SKILL.md 解析
  parseSkillMd,
  parseSkillMdFile,
  parseSkillFromDir,
  hasValidSkillMd,
  validateSkillName,
  validateSkillDescription,
  generateSkillMd,
  SkillValidationError,
} from './core/index.js';

// Type exports
export type {
  SkillsJson,
  SkillsLock,
  SkillJson,
  LockedSkill,
  ParsedSkillRef,
  ParsedVersion,
  VersionType,
  InstalledSkill,
  InstallOptions,
  UpdateOptions,
  ListOptions,
  // Multi-Agent 类型
  AgentType,
  AgentConfig,
  InstallMode,
  InstallResult,
  SkillMdFrontmatter,
  ParsedSkill,
} from './types/index.js';

// Utility exports
export { logger } from './utils/index.js';
export {
  getCanonicalSkillsDir,
  getCanonicalSkillPath,
  shortenPath,
  isPathSafe,
  sanitizeName,
} from './utils/fs.js';
