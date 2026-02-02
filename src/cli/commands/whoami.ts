/**
 * whoami command - Show current authenticated user
 *
 * Displays the currently logged in user for a registry
 */

import { Command } from 'commander';
import { AuthManager } from '../../core/auth-manager.js';
import { RegistryClient, RegistryError } from '../../core/registry-client.js';
import { logger } from '../../utils/logger.js';
import { resolveRegistry } from '../../utils/registry.js';

// ============================================================================
// Types
// ============================================================================

interface WhoamiOptions {
  registry?: string;
}

// ============================================================================
// Main Action
// ============================================================================

async function whoamiAction(options: WhoamiOptions): Promise<void> {
  const registry = resolveRegistry(options.registry);
  const authManager = new AuthManager();

  // Check if logged in locally
  const token = authManager.getToken(registry);
  if (!token) {
    logger.log(`Not logged in to ${registry}`);
    logger.newline();
    logger.log("Run 'reskill login' to authenticate.");
    process.exit(1);
  }

  // Verify with server
  const client = new RegistryClient({ registry, token });

  try {
    const response = await client.whoami();

    if (!response.success || !response.user) {
      logger.error('Failed to get user info');
      process.exit(1);
    }

    const { user } = response;

    logger.log(`@${user.handle}`);
    logger.log(`  Username: ${user.id}`);
    logger.log(`  Registry: ${registry}`);
  } catch (error) {
    if (error instanceof RegistryError) {
      if (error.statusCode === 401) {
        logger.error('Token is invalid or expired');
        logger.newline();
        logger.log("Run 'reskill login' to re-authenticate.");
      } else {
        logger.error(`Failed: ${error.message}`);
      }
    } else {
      logger.error(`Failed: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}

// ============================================================================
// Command Definition
// ============================================================================

export const whoamiCommand = new Command('whoami')
  .description('Show current authenticated user')
  .option(
    '-r, --registry <url>',
    'Registry URL (or set RESKILL_REGISTRY env var, or defaults.publishRegistry in skills.json)',
  )
  .action(whoamiAction);

export default whoamiCommand;
