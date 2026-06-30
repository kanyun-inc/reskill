/**
 * Registry-Scope Mapping Utilities
 *
 * Maps registry URLs to their corresponding scopes.
 * Currently hardcoded; TODO: fetch from /api/registry/info in the future.
 */

/**
 * Public Registry URL
 * Used for installing skills without a scope
 */
export const PUBLIC_REGISTRY = 'https://reskill.info/';

/**
 * Hardcoded registry to scope mapping
 * TODO: Replace with dynamic fetching from /api/registry/info
 */
export const REGISTRY_SCOPE_MAP: Record<string, string> = {
  // rush-app (private registry, new)
  'https://rush-test.zhenguanyu.com': '@kanyun-test',
  'https://rush.zhenguanyu.com': '@kanyun',
  // reskill-app (private registry, legacy)
  'https://reskill-test.zhenguanyu.com': '@kanyun-test',
  // Local development
  'http://localhost:3000': '@kanyun-test',
};

/**
 * Parsed skill name result
 */
export interface ParsedSkillName {
  /** Scope including @ prefix, e.g., "@kanyun" */
  scope: string | null;
  /** Short name without scope, e.g., "planning-with-files" */
  name: string;
  /** Full name as provided, e.g., "@kanyun/planning-with-files" */
  fullName: string;
}

/**
 * Parsed skill identifier result (with version)
 * Used by the install command to parse skill identifiers
 */
export interface ParsedSkillIdentifier {
  /** Scope including @ prefix, e.g., "@kanyun". Null for public registry skills */
  scope: string | null;
  /** Short name without scope, e.g., "planning-with-files" */
  name: string;
  /** Version or tag, e.g., "2.4.5" or "latest". Undefined when not specified */
  version: string | undefined;
  /** Full name without version, e.g., "@kanyun/planning-with-files" */
  fullName: string;
}

/**
 * Get the scope for a given registry URL
 *
 * @param registry - Registry URL
 * @returns Scope string (e.g., "@kanyun") or null if not found
 *
 * @example
 * getScopeForRegistry('https://rush-test.zhenguanyu.com') // '@kanyun'
 * getScopeForRegistry('https://unknown.com') // null
 */
export function getScopeForRegistry(registry: string): string | null {
  if (!registry) {
    return null;
  }

  // Try exact match first
  if (REGISTRY_SCOPE_MAP[registry]) {
    return REGISTRY_SCOPE_MAP[registry];
  }

  // Try with/without trailing slash
  const normalized = registry.endsWith('/') ? registry.slice(0, -1) : `${registry}/`;

  return REGISTRY_SCOPE_MAP[normalized] || null;
}

/**
 * Custom scope registries configuration
 * Maps scope names to registry URLs
 */
export type ScopeRegistries = Record<string, string>;

/**
 * Get the registry URL for a given scope (reverse lookup)
 *
 * @param scope - Scope string (with or without @ prefix), e.g., "@kanyun" or "kanyun"
 * @param customRegistries - Optional custom scope-to-registry mapping (from skills.json)
 * @returns Registry URL (with trailing slash) or null if not found
 *
 * @example
 * getRegistryForScope('@kanyun') // 'https://rush-test.zhenguanyu.com/'
 * getRegistryForScope('kanyun') // 'https://rush-test.zhenguanyu.com/'
 * getRegistryForScope('@unknown') // null
 * getRegistryForScope('@mycompany', { '@mycompany': 'https://my.registry.com/' }) // 'https://my.registry.com/'
 */
export function getRegistryForScope(
  scope: string,
  customRegistries?: ScopeRegistries,
): string | null {
  if (!scope) {
    return null;
  }

  // Normalize scope: ensure @ prefix
  const normalizedScope = scope.startsWith('@') ? scope : `@${scope}`;

  // 1. First check custom scopeRegistries (from skills.json)
  if (customRegistries?.[normalizedScope]) {
    const url = customRegistries[normalizedScope];
    // Normalize trailing slash
    return url.endsWith('/') ? url : `${url}/`;
  }

  // 2. Fall back to hardcoded defaults
  for (const [registry, registryScope] of Object.entries(REGISTRY_SCOPE_MAP)) {
    if (registryScope === normalizedScope) {
      // Return URL with trailing slash (normalized format)
      return registry.endsWith('/') ? registry : `${registry}/`;
    }
  }

  return null;
}

/**
 * Get the registry URL for a given scope
 *
 * - With scope → lookup private Registry (throws if not found)
 * - Without scope (null/undefined/'') → returns public Registry
 *
 * @param scope - Scope string (with or without @ prefix), null, undefined, or empty string
 * @param customRegistries - Optional custom scope-to-registry mapping (from skills.json)
 * @returns Registry URL (with trailing slash)
 * @throws Error if scope is provided but not found in the registry map
 *
 * @example
 * getRegistryUrl('@kanyun') // 'https://rush-test.zhenguanyu.com/'
 * getRegistryUrl('kanyun') // 'https://rush-test.zhenguanyu.com/'
 * getRegistryUrl(null) // 'https://reskill.info/'
 * getRegistryUrl('') // 'https://reskill.info/'
 * getRegistryUrl('@unknown') // throws Error
 * getRegistryUrl('@mycompany', { '@mycompany': 'https://my.registry.com/' }) // 'https://my.registry.com/'
 */
export function getRegistryUrl(
  scope: string | null | undefined,
  customRegistries?: ScopeRegistries,
): string {
  // No scope → return public Registry
  if (!scope) {
    return PUBLIC_REGISTRY;
  }

  // With scope → lookup private Registry
  const registry = getRegistryForScope(scope, customRegistries);

  if (!registry) {
    // Normalize scope for error message
    const normalizedScope = scope.startsWith('@') ? scope : `@${scope}`;
    throw new Error(`Unknown scope ${normalizedScope}. No registry configured for this scope.`);
  }

  return registry;
}

/**
 * Parse a skill name into its components
 *
 * @param skillName - Full or short skill name
 * @returns Parsed skill name with scope and name
 *
 * @example
 * parseSkillName('@kanyun/planning-with-files')
 * // { scope: '@kanyun', name: 'planning-with-files', fullName: '@kanyun/planning-with-files' }
 *
 * parseSkillName('planning-with-files')
 * // { scope: null, name: 'planning-with-files', fullName: 'planning-with-files' }
 */
export function parseSkillName(skillName: string): ParsedSkillName {
  // Match @scope/name pattern
  const match = skillName.match(/^(@[^/]+)\/(.+)$/);

  if (match) {
    return {
      scope: match[1],
      name: match[2],
      fullName: skillName,
    };
  }

  return {
    scope: null,
    name: skillName,
    fullName: skillName,
  };
}

/**
 * Build full skill name from scope and name
 *
 * @param scope - Scope (with or without @ prefix), or null
 * @param name - Short skill name
 * @returns Full skill name (e.g., "@kanyun/planning-with-files")
 *
 * @example
 * buildFullSkillName('@kanyun', 'planning-with-files') // '@kanyun/planning-with-files'
 * buildFullSkillName('kanyun', 'my-skill') // '@kanyun/my-skill'
 * buildFullSkillName(null, 'my-skill') // 'my-skill'
 */
export function buildFullSkillName(scope: string | null, name: string): string {
  if (!scope) {
    return name;
  }

  // Ensure scope starts with @
  const normalizedScope = scope.startsWith('@') ? scope : `@${scope}`;

  return `${normalizedScope}/${name}`;
}

/**
 * Get short name from a skill name (removes scope if present)
 *
 * @param skillName - Full or short skill name
 * @returns Short name without scope
 *
 * @example
 * getShortName('@kanyun/planning-with-files') // 'planning-with-files'
 * getShortName('planning-with-files') // 'planning-with-files'
 */
export function getShortName(skillName: string): string {
  return parseSkillName(skillName).name;
}

/**
 * Parse a skill identifier into its components (with version support)
 *
 * Supports both private registry (with @scope) and public registry (without scope) formats.
 *
 * @param identifier - Skill identifier string
 * @returns Parsed skill identifier with scope, name, version, and fullName
 * @throws Error if identifier is invalid
 *
 * @example
 * // Private registry
 * parseSkillIdentifier('@kanyun/planning-with-files')
 * // { scope: '@kanyun', name: 'planning-with-files', version: undefined, fullName: '@kanyun/planning-with-files' }
 *
 * parseSkillIdentifier('@kanyun/skill@2.4.5')
 * // { scope: '@kanyun', name: 'skill', version: '2.4.5', fullName: '@kanyun/skill' }
 *
 * // Public registry
 * parseSkillIdentifier('planning-with-files')
 * // { scope: null, name: 'planning-with-files', version: undefined, fullName: 'planning-with-files' }
 *
 * parseSkillIdentifier('skill@latest')
 * // { scope: null, name: 'skill', version: 'latest', fullName: 'skill' }
 */
export function parseSkillIdentifier(identifier: string): ParsedSkillIdentifier {
  const trimmed = identifier.trim();

  // Empty string or whitespace only
  if (!trimmed) {
    throw new Error('Invalid skill identifier: empty string');
  }

  // Starting with @@ is invalid
  if (trimmed.startsWith('@@')) {
    throw new Error('Invalid skill identifier: invalid scope format');
  }

  // Bare @ is invalid
  if (trimmed === '@') {
    throw new Error('Invalid skill identifier: missing scope and name');
  }

  // Scoped format: @scope/name[@version]
  if (trimmed.startsWith('@')) {
    // Regex: @scope/name[@version]
    // scope: starts with @, followed by alphanumeric, hyphens, underscores
    // name: alphanumeric, hyphens, underscores
    // version: optional, @ followed by any non-empty string
    const scopedMatch = trimmed.match(/^(@[\w-]+)\/([\w-]+)(?:@(.+))?$/);

    if (!scopedMatch) {
      throw new Error(`Invalid skill identifier: ${identifier}`);
    }

    const [, scope, name, version] = scopedMatch;

    return {
      scope,
      name,
      version: version || undefined,
      fullName: `${scope}/${name}`,
    };
  }

  // Unscoped format: name[@version] (public registry)
  // name must not contain / (otherwise it might be a git shorthand)
  const unscopedMatch = trimmed.match(/^([\w-]+)(?:@(.+))?$/);

  if (!unscopedMatch) {
    throw new Error(`Invalid skill identifier: ${identifier}`);
  }

  const [, name, version] = unscopedMatch;

  return {
    scope: null,
    name,
    version: version || undefined,
    fullName: name,
  };
}
