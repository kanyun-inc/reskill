/**
 * group command - Manage skill groups
 *
 * Provides subcommands for listing, creating, inspecting, and deleting
 * skill groups, as well as managing group membership.
 *
 * Usage:
 *   reskill group list                           # List visible groups
 *   reskill group create <name>                  # Create a group
 *   reskill group info <path>                    # Show group details
 *   reskill group delete <path>                  # Delete a group
 *   reskill group member list <path>             # List members
 *   reskill group member add <path> <users...>   # Add members
 *   reskill group member remove <path> <user>    # Remove a member
 *   reskill group member role <path> <user> <role> # Change member role
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { AuthManager } from '../../core/auth-manager.js';
import { RegistryClient, RegistryError } from '../../core/registry-client.js';
import type { GroupDetail, GroupMember, GroupRole, SkillGroup } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { resolveRegistry } from '../../utils/registry.js';

// ============================================================================
// Types
// ============================================================================

interface GroupCommandOptions {
  registry?: string;
  json?: boolean;
  tree?: boolean;
}

interface GroupCreateOptions extends GroupCommandOptions {
  description?: string;
  visibility?: 'public' | 'private';
  parent?: string;
}

interface GroupDeleteOptions extends GroupCommandOptions {
  dryRun?: boolean;
  yes?: boolean;
}

interface MemberAddOptions extends GroupCommandOptions {
  role?: GroupRole;
}

// ============================================================================
// Constants
// ============================================================================

const VALID_ROLES: GroupRole[] = ['owner', 'maintainer', 'developer'];

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const MAX_GROUP_DEPTH = 3;
const MAX_SEGMENT_LENGTH = 64;

// ============================================================================
// Path Normalization
// ============================================================================

/**
 * Normalize a group path for API usage.
 *
 * Rules from spec §13.2:
 * - Strip leading/trailing slashes and whitespace
 * - Collapse consecutive slashes
 * - Lowercase
 * - Allow only a-z, 0-9, -, /
 *
 * @internal Exported for testing
 */
export function normalizeGroupPath(raw: string): string {
  return raw
    .trim()
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '')
    .toLowerCase();
}

/**
 * Generate a URL-safe slug from a human-readable name.
 *
 * Spec §13.4:
 * - Lowercase, trim, replace spaces/underscores with hyphens
 * - Strip non-alphanumeric characters (except hyphens)
 * - Collapse consecutive hyphens, strip leading/trailing hyphens
 *
 * @internal Exported for testing
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_SEGMENT_LENGTH);
}

/**
 * Validate a normalized group path.
 *
 * Spec §13.2:
 * - Segment slug must match SLUG_REGEX
 * - Segment length <= 64
 * - Max depth <= 3
 */
export function validateGroupPath(path: string): { valid: true } | { valid: false; error: string } {
  if (!path) {
    return { valid: false, error: 'Group path cannot be empty' };
  }

  const segments = path.split('/');
  if (segments.length > MAX_GROUP_DEPTH) {
    return {
      valid: false,
      error: `Group path depth cannot exceed ${MAX_GROUP_DEPTH} segments`,
    };
  }

  for (const segment of segments) {
    if (segment.length > MAX_SEGMENT_LENGTH) {
      return {
        valid: false,
        error: `Group path segment "${segment}" exceeds ${MAX_SEGMENT_LENGTH} characters`,
      };
    }
    if (!SLUG_REGEX.test(segment)) {
      return {
        valid: false,
        error: `Invalid group path segment "${segment}". Segments must match ${SLUG_REGEX}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate that a role string is one of the allowed values.
 */
function validateRole(role: string): role is GroupRole {
  return VALID_ROLES.includes(role as GroupRole);
}

function assertValidGroupPath(path: string): void {
  const validation = validateGroupPath(path);
  if (!validation.valid) {
    logger.error(validation.error);
    process.exit(1);
  }
}

// ============================================================================
// Client Factory
// ============================================================================

function createClient(registry: string): RegistryClient {
  const authManager = new AuthManager();
  const token = authManager.getToken(registry);

  if (!token) {
    logger.error('Authentication required');
    logger.newline();
    logger.log("Run 'reskill login' to authenticate.");
    process.exit(1);
  }

  return new RegistryClient({ registry, token });
}

// ============================================================================
// Display Helpers
// ============================================================================

function getGroupIndentLevel(group: SkillGroup): number {
  if (typeof group.level === 'number' && Number.isFinite(group.level)) {
    return Math.max(0, group.level - 1);
  }
  return Math.max(0, group.path.split('/').length - 1);
}

function displayGroupList(groups: SkillGroup[], json: boolean, tree = false): void {
  if (json) {
    console.log(JSON.stringify(groups, null, 2));
    return;
  }

  if (groups.length === 0) {
    logger.warn('No groups found');
    return;
  }

  logger.newline();
  logger.log(`Found ${chalk.bold(String(groups.length))} group${groups.length === 1 ? '' : 's'}:`);
  logger.newline();

  if (tree) {
    const sortedGroups = [...groups].sort((a, b) => a.path.localeCompare(b.path));
    for (const group of sortedGroups) {
      const vis = group.visibility === 'private' ? chalk.yellow(' (private)') : '';
      const desc = group.description ? chalk.gray(` - ${group.description}`) : '';
      const indent = '  '.repeat(getGroupIndentLevel(group));
      const nodeLabel = group.path.split('/').pop() || group.path;
      logger.log(`  ${indent}└─ ${chalk.bold.cyan(nodeLabel)}${vis}${desc} ${chalk.gray(`(${group.path})`)}`);
    }
    logger.newline();
    return;
  }

  for (const group of groups) {
    const vis = group.visibility === 'private' ? chalk.yellow(' (private)') : '';
    const desc = group.description ? chalk.gray(` - ${group.description}`) : '';
    logger.log(`  ${chalk.bold.cyan(group.path)}${vis}${desc}`);
    const meta: string[] = [];
    if (group.skill_count !== undefined) meta.push(`${group.skill_count} skill(s)`);
    if (group.member_count !== undefined) meta.push(`${group.member_count} member(s)`);
    if (meta.length > 0) {
      logger.log(`    ${chalk.gray(meta.join(' · '))}`);
    }
  }
  logger.newline();
}

function displayGroupDetail(detail: GroupDetail, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(detail, null, 2));
    return;
  }

  logger.newline();
  logger.log(`${chalk.bold(detail.name)} ${chalk.gray(`(${detail.path})`)}`);

  if (detail.description) {
    logger.log(`  ${detail.description}`);
  }

  logger.newline();
  const vis = detail.visibility === 'private' ? chalk.yellow('private') : chalk.green('public');
  logger.log(`  Visibility:  ${vis}`);
  logger.log(`  Level:       ${detail.level}`);

  if (detail.skill_count !== undefined) {
    logger.log(`  Skills:      ${detail.skill_count}`);
  }
  if (detail.member_count !== undefined) {
    logger.log(`  Members:     ${detail.member_count}`);
  }
  if (detail.current_user_role) {
    logger.log(`  Your role:   ${chalk.bold(detail.current_user_role)}`);
  }

  if (detail.children && detail.children.length > 0) {
    logger.newline();
    logger.log('  Sub groups:');
    for (const child of detail.children) {
      logger.log(`    • ${child.path}`);
    }
  }

  logger.newline();
}

function displayMemberList(members: GroupMember[], groupPath: string, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(members, null, 2));
    return;
  }

  if (members.length === 0) {
    logger.warn(`No members in group "${groupPath}"`);
    return;
  }

  logger.newline();
  logger.log(
    `${chalk.bold(String(members.length))} member${members.length === 1 ? '' : 's'} in ${chalk.bold(groupPath)}:`,
  );
  logger.newline();

  for (const member of members) {
    const role = chalk.bold(member.role);
    const handle = member.handle || member.user_id;
    logger.log(`  ${handle}  ${role}`);
  }
  logger.newline();
}

// ============================================================================
// Subcommand Actions
// ============================================================================

async function listAction(options: GroupCommandOptions): Promise<void> {
  const registry = resolveRegistry(options.registry);
  const client = createClient(registry);

  try {
    const groups = await client.listGroups({ flat: Boolean(options.tree) });
    displayGroupList(groups, options.json || false, Boolean(options.tree));
  } catch (error) {
    if (error instanceof RegistryError) {
      logger.error(`Failed to list groups: ${error.message}`);
    } else {
      logger.error(`Failed to list groups: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}

async function createAction(name: string, options: GroupCreateOptions): Promise<void> {
  const registry = resolveRegistry(options.registry);

  const slug = generateSlug(name);
  if (!SLUG_REGEX.test(slug)) {
    logger.error(
      `Generated slug "${slug}" is invalid. Name must produce a slug matching ${SLUG_REGEX.source}`,
    );
    process.exit(1);
  }

  let parentId: string | undefined;
  let client: RegistryClient | undefined;
  if (options.parent) {
    const normalizedParent = normalizeGroupPath(options.parent);
    assertValidGroupPath(normalizedParent);
    client = createClient(registry);
    try {
      const parentGroup = await client.resolveGroup(normalizedParent);
      parentId = parentGroup.id;
    } catch (error) {
      if (error instanceof RegistryError) {
        logger.error(`Parent group "${options.parent}" not found`);
      } else {
        logger.error(`Failed to resolve parent: ${(error as Error).message}`);
      }
      process.exit(1);
    }
  }

  try {
    const ensuredClient = client ?? createClient(registry);
    const group = await ensuredClient.createGroup({
      name,
      slug,
      description: options.description,
      visibility: options.visibility,
      parent_id: parentId,
    });

    if (options.json) {
      console.log(JSON.stringify(group, null, 2));
    } else {
      logger.newline();
      logger.success(`Group created: ${chalk.bold(group.path)}`);
      logger.log(`  ID:         ${group.id}`);
      logger.log(`  Visibility: ${group.visibility}`);
      logger.newline();
    }
  } catch (error) {
    if (error instanceof RegistryError) {
      logger.error(`Failed to create group: ${error.message}`);
    } else {
      logger.error(`Failed to create group: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}

async function infoAction(groupPath: string, options: GroupCommandOptions): Promise<void> {
  const normalized = normalizeGroupPath(groupPath);
  assertValidGroupPath(normalized);
  const registry = resolveRegistry(options.registry);
  const client = createClient(registry);

  try {
    const detail = await client.resolveGroup(normalized);
    displayGroupDetail(detail, options.json || false);
  } catch (error) {
    if (error instanceof RegistryError) {
      if (error.statusCode === 404) {
        logger.error(`Group "${groupPath}" not found`);
      } else {
        logger.error(`Failed to get group info: ${error.message}`);
      }
    } else {
      logger.error(`Failed to get group info: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}

async function deleteAction(groupPath: string, options: GroupDeleteOptions): Promise<void> {
  const normalized = normalizeGroupPath(groupPath);
  assertValidGroupPath(normalized);
  const registry = resolveRegistry(options.registry);
  const client = createClient(registry);

  try {
    const detail = await client.resolveGroup(normalized);

    if (options.dryRun) {
      const result = await client.deleteGroup(detail.id, true);
      logger.newline();
      logger.log(`Dry run: deleting group "${chalk.bold(groupPath)}"`);
      if (result.affected_skills !== undefined) {
        logger.log(`  Affected skills: ${result.affected_skills}`);
      }
      logger.log('No changes made (--dry-run)');
      logger.newline();
      return;
    }

    if (!options.yes) {
      const { createInterface } = await import('node:readline');
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise<string>((resolve) => {
        rl.question(`\n? Delete group "${groupPath}" and all its contents? (y/N) `, resolve);
        rl.once('close', () => resolve(''));
      });
      rl.close();
      if (answer.trim().toLowerCase() !== 'y' && answer.trim().toLowerCase() !== 'yes') {
        logger.log('Cancelled.');
        return;
      }
    }

    await client.deleteGroup(detail.id, false);
    logger.success(`Group "${groupPath}" deleted`);
  } catch (error) {
    if (error instanceof RegistryError) {
      if (error.statusCode === 404) {
        logger.error(`Group "${groupPath}" not found`);
      } else {
        logger.error(`Failed to delete group: ${error.message}`);
      }
    } else {
      logger.error(`Failed to delete group: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}

// ============================================================================
// Member Subcommand Actions
// ============================================================================

async function memberListAction(groupPath: string, options: GroupCommandOptions): Promise<void> {
  const normalized = normalizeGroupPath(groupPath);
  assertValidGroupPath(normalized);
  const registry = resolveRegistry(options.registry);
  const client = createClient(registry);

  try {
    const detail = await client.resolveGroup(normalized);
    const members = await client.listGroupMembers(detail.id);
    displayMemberList(members, groupPath, options.json || false);
  } catch (error) {
    if (error instanceof RegistryError) {
      logger.error(`Failed to list members: ${error.message}`);
    } else {
      logger.error(`Failed to list members: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}

async function memberAddAction(
  groupPath: string,
  userIds: string[],
  options: MemberAddOptions,
): Promise<void> {
  const normalized = normalizeGroupPath(groupPath);
  assertValidGroupPath(normalized);
  const registry = resolveRegistry(options.registry);
  const client = createClient(registry);
  const role = options.role || 'developer';

  if (!validateRole(role)) {
    logger.error(`Invalid role "${role}". Must be one of: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }

  try {
    const detail = await client.resolveGroup(normalized);
    await client.addGroupMembers(detail.id, userIds, role);
    logger.success(`Added ${userIds.length} member(s) to "${groupPath}" as ${chalk.bold(role)}`);
  } catch (error) {
    if (error instanceof RegistryError) {
      logger.error(`Failed to add members: ${error.message}`);
    } else {
      logger.error(`Failed to add members: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}

async function memberRemoveAction(
  groupPath: string,
  userId: string,
  options: GroupCommandOptions,
): Promise<void> {
  const normalized = normalizeGroupPath(groupPath);
  assertValidGroupPath(normalized);
  const registry = resolveRegistry(options.registry);
  const client = createClient(registry);

  try {
    const detail = await client.resolveGroup(normalized);
    await client.removeGroupMember(detail.id, userId);
    logger.success(`Removed "${userId}" from "${groupPath}"`);
  } catch (error) {
    if (error instanceof RegistryError) {
      logger.error(`Failed to remove member: ${error.message}`);
    } else {
      logger.error(`Failed to remove member: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}

async function memberRoleAction(
  groupPath: string,
  userId: string,
  role: string,
  options: GroupCommandOptions,
): Promise<void> {
  const normalized = normalizeGroupPath(groupPath);
  assertValidGroupPath(normalized);
  const registry = resolveRegistry(options.registry);
  const client = createClient(registry);

  if (!validateRole(role)) {
    logger.error(`Invalid role "${role}". Must be one of: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }

  try {
    const detail = await client.resolveGroup(normalized);
    await client.updateGroupMemberRole(detail.id, userId, role as GroupRole);
    logger.success(`Updated role of "${userId}" in "${groupPath}" to ${chalk.bold(role)}`);
  } catch (error) {
    if (error instanceof RegistryError) {
      logger.error(`Failed to update role: ${error.message}`);
    } else {
      logger.error(`Failed to update role: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}

// ============================================================================
// Command Definitions
// ============================================================================

const memberCommand = new Command('member').description('Manage group members');

memberCommand
  .command('list <path>')
  .description('List members of a group')
  .option('-r, --registry <url>', 'Registry URL')
  .option('-j, --json', 'Output as JSON')
  .action(memberListAction);

memberCommand
  .command('add <path> <users...>')
  .description('Add members to a group')
  .option('-r, --registry <url>', 'Registry URL')
  .option('--role <role>', 'Role to assign (owner|maintainer|developer)', 'developer')
  .action(memberAddAction);

memberCommand
  .command('remove <path> <user>')
  .description('Remove a member from a group')
  .option('-r, --registry <url>', 'Registry URL')
  .action(memberRemoveAction);

memberCommand
  .command('role <path> <user> <role>')
  .description("Change a member's role")
  .option('-r, --registry <url>', 'Registry URL')
  .action(memberRoleAction);

export const groupCommand = new Command('group').description('Manage skill groups');

groupCommand
  .command('list')
  .description('List visible groups')
  .option('-r, --registry <url>', 'Registry URL')
  .option('--tree', 'Render groups as a tree (requests flat group list)')
  .option('-j, --json', 'Output as JSON')
  .action(listAction);

groupCommand
  .command('create <name>')
  .description('Create a new group')
  .option('-r, --registry <url>', 'Registry URL')
  .option('-d, --description <text>', 'Group description')
  .option('--visibility <level>', 'Visibility: public or private', 'public')
  .option('--parent <path>', 'Parent group path (for sub groups)')
  .option('-j, --json', 'Output as JSON')
  .action(createAction);

groupCommand
  .command('info <path>')
  .description('Show group details')
  .option('-r, --registry <url>', 'Registry URL')
  .option('-j, --json', 'Output as JSON')
  .action(infoAction);

groupCommand
  .command('delete <path>')
  .description('Delete a group')
  .option('-r, --registry <url>', 'Registry URL')
  .option('-n, --dry-run', 'Preview deletion without executing')
  .option('-y, --yes', 'Skip confirmation')
  .action(deleteAction);

groupCommand.addCommand(memberCommand);

export default groupCommand;
