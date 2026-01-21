export { GitResolver } from './git-resolver.js';
export { CacheManager } from './cache-manager.js';
export { ConfigLoader, DEFAULT_REGISTRIES } from './config-loader.js';
export { LockManager } from './lock-manager.js';
export { SkillManager } from './skill-manager.js';
export type { SkillManagerOptions } from './skill-manager.js';

// Multi-Agent 支持
export {
  agents,
  detectInstalledAgents,
  getAgentConfig,
  getAllAgentTypes,
  isValidAgentType,
  getAgentSkillsDir,
} from './agent-registry.js';
export type { AgentType, AgentConfig } from './agent-registry.js';

export { Installer } from './installer.js';
export type { InstallMode, InstallResult, InstallerOptions } from './installer.js';

export {
  parseSkillMd,
  parseSkillMdFile,
  parseSkillFromDir,
  hasValidSkillMd,
  validateSkillName,
  validateSkillDescription,
  generateSkillMd,
  SkillValidationError,
} from './skill-parser.js';
export type { SkillMdFrontmatter, ParsedSkill } from './skill-parser.js';
