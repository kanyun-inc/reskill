/**
 * login command - Authenticate with a reskill registry
 *
 * Logs in to the registry and stores the token in ~/.reskillrc
 */

import { Command } from 'commander';
import { createInterface } from 'node:readline';
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
// Helper Functions
// ============================================================================

/**
 * Prompt for input (with optional masking for passwords)
 */
function prompt(question: string, hidden = false): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (hidden && process.stdin.isTTY) {
      // Hide password input
      process.stdout.write(question);
      let input = '';

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      const onData = (char: string) => {
        if (char === '\n' || char === '\r') {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (char === '\u0003') {
          // Ctrl+C
          process.exit(0);
        } else if (char === '\u007F' || char === '\b') {
          // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
          }
        } else {
          input += char;
        }
      };

      process.stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

// ============================================================================
// Main Action
// ============================================================================

async function loginAction(options: LoginOptions): Promise<void> {
  const registry = resolveRegistry(options.registry);
  const authManager = new AuthManager();

  // If token is provided directly, save it and verify
  if (options.token) {
    await loginWithToken(options.token, registry, authManager);
    return;
  }

  // Check if already logged in
  const existingToken = authManager.getToken(registry);
  if (existingToken) {
    const existingEmail = authManager.getEmail(registry);
    logger.log(`Already logged in to ${registry}`);
    if (existingEmail) {
      logger.log(`  Email: ${existingEmail}`);
    }
    logger.newline();

    const overwrite = await prompt('Do you want to login with a different account? (y/N) ');
    if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
      logger.log('Cancelled.');
      return;
    }
    logger.newline();
  }

  logger.log(`Logging in to ${registry}...`);
  logger.newline();

  // Prompt for credentials
  const email = await prompt('Email: ');
  if (!email.trim()) {
    logger.error('Email is required');
    process.exit(1);
  }

  const password = await prompt('Password: ', true);
  if (!password) {
    logger.error('Password is required');
    process.exit(1);
  }

  logger.newline();

  // Login
  const client = new RegistryClient({ registry });

  try {
    const response = await client.login({ email: email.trim(), password });

    if (!response.success || !response.token || !response.publisher) {
      logger.error(response.error || 'Login failed');
      process.exit(1);
    }

    // Save token with handle
    authManager.setToken(response.token.secret, registry, response.publisher.email, response.publisher.handle);

    logger.log('✓ Logged in successfully!');
    logger.newline();
    logger.log(`  Handle: @${response.publisher.handle}`);
    logger.log(`  Email: ${response.publisher.email}`);
    logger.log(`  Registry: ${registry}`);
    logger.newline();
    logger.log(`Token saved to ${authManager.getConfigPath()}`);

  } catch (error) {
    if (error instanceof RegistryError) {
      logger.error(`Login failed: ${error.message}`);
      if (error.statusCode === 401) {
        logger.log('Please check your email and password.');
      }
    } else {
      logger.error(`Login failed: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}

/**
 * Login with a pre-generated token (e.g., from web UI after CAS/OAuth login)
 */
async function loginWithToken(token: string, registry: string, authManager: AuthManager): Promise<void> {
  logger.log(`Verifying token with ${registry}...`);
  logger.newline();

  // Verify token by calling whoami
  const client = new RegistryClient({ registry, token });

  try {
    const response = await client.whoami();

    if (!response.success || !response.user) {
      logger.error(response.error || 'Token verification failed');
      process.exit(1);
    }

    // Save token with handle (using user.id as handle)
    authManager.setToken(token, registry, undefined, response.user.id);

    logger.log('✓ Token verified and saved!');
    logger.newline();
    logger.log(`  Handle: @${response.user.id}`);
    logger.log(`  Registry: ${registry}`);
    logger.newline();
    logger.log(`Token saved to ${authManager.getConfigPath()}`);

  } catch (error) {
    if (error instanceof RegistryError) {
      logger.error(`Token verification failed: ${error.message}`);
      if (error.statusCode === 401) {
        logger.log('The token is invalid or expired. Please generate a new token from the web UI.');
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
  .option('-r, --registry <url>', 'Registry URL (or set RESKILL_REGISTRY env var, or defaults.publishRegistry in skills.json)')
  .option('-t, --token <token>', 'Use a pre-generated token (from web UI after CAS/OAuth login)')
  .action(loginAction);

export default loginCommand;
