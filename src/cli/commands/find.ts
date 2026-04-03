/**
 * find command - Search for skills in the registry
 *
 * Supports both public and private registries via --registry option.
 * Resolves registry from CLI option > RESKILL_REGISTRY env > skills.json config.
 *
 * Usage:
 *   reskill find <query>                  # Search public registry
 *   reskill find <query> --registry <url> # Search private registry
 *   reskill find <query> --json           # Output as JSON
 *   reskill find <query> --limit 5        # Limit results
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { AuthManager } from '../../core/auth-manager.js';
import {
  RegistryClient,
  RegistryError,
  type SearchResultItem,
} from '../../core/registry-client.js';
import { logger } from '../../utils/logger.js';
import { resolveRegistryForSearch } from '../../utils/registry.js';

// ============================================================================
// Types
// ============================================================================

interface FindOptions {
  registry?: string;
  limit?: string;
  json?: boolean;
  token?: string;
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Format a single search result for terminal display
 */
function formatResultItem(item: SearchResultItem, index: number): string {
  const lines: string[] = [];

  const name = chalk.bold.cyan(item.name);
  const version = item.latest_version ? chalk.gray(`@${item.latest_version}`) : '';
  lines.push(`  ${chalk.gray(`${index + 1}.`)} ${name}${version}`);

  if (item.description) {
    const desc =
      item.description.length > 80 ? `${item.description.slice(0, 80)}...` : item.description;
    lines.push(`     ${desc}`);
  }

  const meta: string[] = [];
  if (item.keywords && item.keywords.length > 0) {
    meta.push(chalk.gray(`keywords: ${item.keywords.join(', ')}`));
  }
  if (item.publisher?.handle) {
    meta.push(chalk.gray(`by ${item.publisher.handle}`));
  }

  if (meta.length > 0) {
    lines.push(`     ${meta.join(' · ')}`);
  }

  return lines.join('\n');
}

/**
 * Display search results in human-readable format
 */
function displayResults(items: SearchResultItem[], total: number, query: string): void {
  if (items.length === 0) {
    logger.warn(`No skills found for "${query}"`);
    return;
  }

  logger.newline();
  logger.log(
    `Found ${chalk.bold(String(total))} skill${total === 1 ? '' : 's'} matching "${chalk.bold(query)}":`,
  );
  logger.newline();

  for (let i = 0; i < items.length; i++) {
    logger.log(formatResultItem(items[i], i));
    if (i < items.length - 1) {
      logger.newline();
    }
  }

  logger.newline();
  logger.log(chalk.gray('Install with: reskill install <name>'));
}

/**
 * Display search results as JSON
 */
function displayJsonResults(items: SearchResultItem[], total: number): void {
  console.log(JSON.stringify({ total, items }, null, 2));
}

// ============================================================================
// Main Action
// ============================================================================

/**
 * Execute the find command
 *
 * @internal Exported for testing
 */
export async function findAction(query: string, options: FindOptions): Promise<void> {
  const limit = Number.parseInt(options.limit || '10', 10);

  if (Number.isNaN(limit) || limit < 1) {
    logger.error('Invalid --limit value. Must be a positive integer.');
    process.exit(1);
    return;
  }

  const registry = resolveRegistryForSearch(options.registry);

  // Resolve auth token: --token flag > RESKILL_TOKEN env > ~/.reskillrc
  let token = options.token;
  if (!token) {
    const authManager = new AuthManager();
    token = authManager.getToken(registry) ?? undefined;
  }

  const client = new RegistryClient({ registry, token });

  try {
    const { items, total } = await client.search(query, { limit });

    if (options.json) {
      displayJsonResults(items, total);
    } else {
      displayResults(items, total, query);
    }
  } catch (error) {
    if (error instanceof RegistryError) {
      logger.error(`Search failed: ${error.message}`);
      if (error.statusCode === 401 || error.statusCode === 403) {
        logger.log('This registry may require authentication. Try: reskill login');
      }
    } else {
      logger.error(`Search failed: ${(error as Error).message}`);
    }
    process.exit(1);
    return;
  }
}

// ============================================================================
// Command Definition
// ============================================================================

export const findCommand = new Command('find')
  .alias('search')
  .description('Search for skills in the registry')
  .argument('<query>', 'Search query')
  .option(
    '-r, --registry <url>',
    'Registry URL (or set RESKILL_REGISTRY env var, or defaults.publishRegistry in skills.json)',
  )
  .option('-l, --limit <n>', 'Maximum number of results', '10')
  .option('-j, --json', 'Output as JSON')
  .option('-t, --token <token>', 'Auth token for registry API requests (for CI/CD)')
  .action(findAction);

export default findCommand;
