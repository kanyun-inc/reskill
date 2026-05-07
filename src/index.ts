/**
 * reskill - AI Skills Package Manager
 *
 * Git-based skills management for AI agents
 * Supports 18+ coding agents: Cursor, Claude Code, Claude Cowork 3P, GitHub Copilot, etc.
 */

// Core exports
export {
  // Multi-Agent support
  agents,
  CacheManager,
  ConfigLoader,
  // Content scanning
  ContentScanError,
  ContentScanner,
  DEFAULT_REGISTRIES,
  DEFAULT_RULES,
  detectInstalledAgents,
  GitResolver,
  generateSkillMd,
  getAgentConfig,
  getAgentSkillsDir,
  getAllAgentTypes,
  // HTTP/OSS support
  HttpResolver,
  hasValidSkillMd,
  Installer,
  isValidAgentType,
  LockManager,
  maskSafeZones,
  parseSkillFromDir,
  // SKILL.md parsing
  parseSkillMd,
  parseSkillMdFile,
  SkillManager,
  SkillValidationError,
  validateSkillDescription,
  validateSkillName,
} from './core/index.js';

// Type exports
export type {
  AgentConfig,
  // Multi-Agent types
  AgentType,
  InstalledSkill,
  InstallMode,
  InstallOptions,
  InstallResult,
  ListOptions,
  LockedSkill,
  ParsedSkill,
  ParsedSkillRef,
  ParsedVersion,
  // Content scanning types
  RiskLevel,
  ScanFinding,
  ScannerOptions,
  ScanResult,
  ScanRule,
  ScanRuleMatch,
  SkillJson,
  SkillMdFrontmatter,
  SkillsJson,
  SkillsLock,
  UpdateOptions,
  VersionType,
} from './types/index.js';
export {
  getCanonicalSkillPath,
  getCanonicalSkillsDir,
  isPathSafe,
  sanitizeName,
  shortenPath,
} from './utils/fs.js';
// Utility exports
export { logger } from './utils/index.js';
