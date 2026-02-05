/**
 * login command - Authenticate with a reskill registry
 *
 * Token-only login: requires a pre-generated token from Web UI.
 * Logs in to the registry and stores the token in ~/.reskillrc
 */

import { Command } from 'commander';
import { AuthManager } from '../../core/auth-manager.js';
import { RegistryClient, RegistryError } from '../../core/registry-client.js';
import { logger } from '../../utils/logger.js';
import { resolveRegistry } from '../../utils/registry.js';

// ============================================================================
// Types
// ============================================================================

interface LoginOptions {
  registry?: string;
  token?: string;
}

// ============================================================================
// Main Action
// ============================================================================

async function loginAction(options: LoginOptions): Promise<void> {
  const registry = resolveRegistry(options.registry);
  const authManager = new AuthManager();

  // Token is required (no email/password login)
  if (!options.token) {
    logger.error('Token is required');
    logger.newline();
    logger.log('To get a token:');
    logger.log('  1. Visit the Registry Web UI');
    logger.log('  2. Login and generate an API token');
    logger.log('  3. Run: reskill login --registry <url> --token <token>');
    process.exit(1);
  }

  await loginWithToken(options.token, registry, authManager);
}

/**
 * Login with a pre-generated token from Web UI
 */
async function loginWithToken(
  token: string,
  registry: string,
  authManager: AuthManager,
): Promise<void> {
  logger.log(`Verifying token with ${registry}...`);
  logger.newline();

  // Verify token by calling login-cli endpoint
  const client = new RegistryClient({ registry, token });

  try {
    const response = await client.loginCli();

    if (!response.success || !response.user) {
      logger.error(response.error || 'Token verification failed');
      process.exit(1);
    }

    // Save token with handle and email
    authManager.setToken(token, registry, response.user.email, response.user.handle);

    logger.log('✓ Token verified and saved!');
    logger.newline();
    logger.log(`  Handle: @${response.user.handle}`);
    logger.log(`  Username: ${response.user.id}`);
    if (response.user.email) {
      logger.log(`  Email: ${response.user.email}`);
    }
    logger.log(`  Registry: ${registry}`);
    logger.newline();
    logger.log(`Token saved to ${authManager.getConfigPath()}`);
  } catch (error) {
    if (error instanceof RegistryError) {
      logger.error(`Token verification failed: ${error.message}`);
      if (error.statusCode === 401) {
        logger.log('The token is invalid or expired. Please generate a new token from the Web UI.');
      }
    } else {
      logger.error(`Token verification failed: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}

// ============================================================================
// Command Definition
// ============================================================================

export const loginCommand = new Command('login')
  .description('Authenticate with a reskill registry')
  .option(
    '-r, --registry <url>',
    'Registry URL (or set RESKILL_REGISTRY env var, or defaults.publishRegistry in skills.json)',
  )
  .option('-t, --token <token>', 'API token from Web UI (required)')
  .action(loginAction);

export default loginCommand;
