/**
 * Skills Package Manager Type Definitions
 * Based on: docs/skills-management-design.md
 */

import type { AgentConfig, AgentType } from '../core/agent-registry.js';

// ============================================================================
// Multi-Agent related types
// ============================================================================

/**
 * Supported Agent types
 */
export type { AgentConfig, AgentType };

/**
 * Installation mode
 */
export type { InstallMode, InstallResult } from '../core/installer.js';

/**
 * SKILL.md parsing related types (following agentskills.io specification)
 */
export type {
  ParsedSkill,
  SkillMdFrontmatter,
} from '../core/skill-parser.js';

// ============================================================================
// skills.json - Project dependency configuration
// ============================================================================

/**
 * Version specification format
 * - Exact version: @v1.0.0
 * - Latest version: @latest
 * - Range version: @^2.0.0 (semver)
 * - Branch: @branch:develop
 * - Commit: @commit:abc1234
 * - No version: defaults to main/master
 */
export type VersionSpec = string;

/**
 * Skill reference format
 * Full format: <registry>:<owner>/<repo>@<version>
 * Short format: <owner>/<repo>@<version>
 */
export type SkillRef = string;

/**
 * Registry configuration
 */
export interface RegistryConfig {
  [name: string]: string;
}

/**
 * Default configuration
 */
export interface SkillsDefaults {
  /** Installation directory, defaults to .skills */
  installDir?: string;
  /** Target agents list */
  targetAgents?: string[];
  /** Installation mode: symlink | copy */
  installMode?: 'symlink' | 'copy';
  /** Registry URL for publishing skills (no default - must be explicitly configured) */
  publishRegistry?: string;
}

/**
 * Skill override configuration
 */
export interface SkillOverride {
  /** Whether enabled */
  enabled?: boolean;
  /** Custom configuration */
  config?: Record<string, unknown>;
}

/**
 * skills.json complete schema
 */
export interface SkillsJson {
  /** JSON Schema reference */
  $schema?: string;
  /** Skill dependency mapping */
  skills: Record<string, SkillRef>;
  /** Registry configuration (for custom git hosts) */
  registries?: RegistryConfig;
  /** Default configuration */
  defaults?: SkillsDefaults;
  /** Skill override configuration */
  overrides?: Record<string, SkillOverride>;
}

// ============================================================================
// skills.lock - Version lock file
// ============================================================================

/**
 * Locked Skill information
 */
export interface LockedSkill {
  /** Source, e.g., github:user/repo */
  source: string;
  /** Semantic version from skill.json */
  version: string;
  /** Git reference (tag, branch, commit) used for installation */
  ref: string;
  /** Actual download URL: Git repo URL, HTTP URL, or registry endpoint */
  resolved: string;
  /** Exact commit hash */
  commit: string;
  /** Installation time */
  installedAt: string;
  /**
   * Registry URL for registry-sourced skills.
   * Used as O(1) fast-path lookup during reinstall/update of unscoped skills
   * (e.g., "find-skills") whose skills.json ref carries no registry info.
   */
  registry?: string;
}

/**
 * skills.lock complete schema
 */
export interface SkillsLock {
  /** Lock file version */
  lockfileVersion: number;
  /** Locked skills */
  skills: Record<string, LockedSkill>;
}

// ============================================================================
// skill.json - Skill repository metadata
// ============================================================================

/**
 * Skill configuration definition
 */
export interface SkillConfigDef {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  default?: unknown;
  description?: string;
}

/**
 * Repository information
 */
export interface SkillRepository {
  type: 'git';
  url: string;
}

/**
 * Compatibility configuration
 */
export interface SkillCompatibility {
  claude?: string;
  cursor?: string;
  [platform: string]: string | undefined;
}

/**
 * skill.json complete schema (Skill repository metadata)
 */
export interface SkillJson {
  /** Skill name */
  name: string;
  /** Version number */
  version: string;
  /** Description */
  description?: string;
  /** Author */
  author?: string;
  /** License */
  license?: string;
  /** Entry file, defaults to SKILL.md */
  entry?: string;
  /** List of included files */
  files?: string[];
  /** Keywords */
  keywords?: string[];
  /** Repository information */
  repository?: SkillRepository;
  /** Configuration items */
  config?: Record<string, SkillConfigDef>;
  /** Platform compatibility */
  compatibility?: SkillCompatibility;
}

// ============================================================================
// Parsed types
// ============================================================================

/**
 * Parsed Skill reference
 */
export interface ParsedSkillRef {
  /** Registry name, e.g., github, gitlab */
  registry: string;
  /** Owner/organization */
  owner: string;
  /** Repository name */
  repo: string;
  /** Sub-path (if monorepo) */
  subPath?: string;
  /** Version specification */
  version?: VersionSpec;
  /** Original reference string */
  raw: string;
  /** Full Git URL (SSH/HTTPS), if provided */
  gitUrl?: string;
  /** Skill name from #fragment (multi-skill repo selector) */
  skillName?: string;
}

/**
 * Version type
 */
export type VersionType =
  | 'exact' // v1.0.0
  | 'latest' // latest
  | 'range' // ^2.0.0, ~1.0.0
  | 'branch' // branch:develop
  | 'commit'; // commit:abc1234

/**
 * Parsed version information
 */
export interface ParsedVersion {
  type: VersionType;
  value: string;
  raw: string;
}

/**
 * Installed Skill information
 */
export interface InstalledSkill {
  /** Skill name */
  name: string;
  /** Installation path */
  path: string;
  /** Version number */
  version: string;
  /** Source */
  source: string;
  /** Skill metadata */
  metadata?: SkillJson;
  /** Whether linked */
  isLinked?: boolean;
  /** Agents that have this skill installed (symlink or copy) */
  agents?: AgentType[];
}

// ============================================================================
// CLI related types
// ============================================================================

/**
 * Registry context for web-published skills.
 *
 * When a skill is discovered via registry but installed from an external source
 * (GitHub/GitLab/OSS), this context carries the registry metadata so the
 * downstream install methods use the registry name instead of deriving from
 * the source URL.
 */
export interface RegistryInstallContext {
  /** Skill name to use (registry short name, e.g., "vercel-react-best-practices") */
  skillName: string;
  /** Ref to store in skills.json (registry identifier, e.g., "@kanyun/vercel-react-best-practices") */
  configRef: string;
  /** Source to store in skills.lock (e.g., "registry:@kanyun/vercel-react-best-practices") */
  lockSource: string;
  /** Registry URL for lock file (used as fallback during reinstall/update) */
  registryUrl: string;
}

/**
 * Installation options
 */
export interface InstallOptions {
  /** Force reinstall */
  force?: boolean;
  /** Save to skills.json */
  save?: boolean;
  /** Global installation */
  global?: boolean;
  /** Target agents list */
  agents?: string[];
  /** Installation mode: symlink | copy */
  mode?: 'symlink' | 'copy';
  /** Skip confirmation */
  yes?: boolean;
  /** Registry URL override (for registry-based installs) */
  registry?: string;
  /** Registry context for web-published skills (carries registry name through Git/HTTP install) */
  registryContext?: RegistryInstallContext;
}

/**
 * Update options
 */
export interface UpdateOptions {
  /** Update all */
  all?: boolean;
}

/**
 * List options
 */
export interface ListOptions {
  /** JSON format output */
  json?: boolean;
}

// ============================================================================
// Registry API types (for web-published skill support)
// ============================================================================

/**
 * Skill source type
 * - registry: published via CLI (supports versioning)
 * - github/gitlab: web-published via remote Git URL
 * - oss_url/custom_url: web-published via remote HTTP URL
 * - local: web-published via local folder (uploaded to OSS)
 */
export type SourceType = 'registry' | 'github' | 'gitlab' | 'oss_url' | 'custom_url' | 'local';

/**
 * Basic skill info returned by the Registry API.
 * Used by the install command to determine the installation logic branch.
 */
export interface SkillInfo {
  /** Full skill name, e.g. @kanyun/my-skill */
  name: string;
  /** Description */
  description?: string;
  /** Source type, defaults to 'registry' (CLI-published) */
  source_type?: SourceType;
  /** Source URL (only present for web-published skills) */
  source_url?: string;
  /** Sub-path within the repository for multi-skill repos, e.g. "skills/accessibility" */
  skill_path?: string;
  /** Publisher ID */
  publisher_id?: string;
  /** Creation timestamp */
  created_at?: string;
  /** Last update timestamp */
  updated_at?: string;
}
