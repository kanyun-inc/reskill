/**
 * login command - Authenticate with a reskill registry
 *
 * Supports two modes:
 * 1. Interactive: prompts user to paste token (default when no --token flag)
 * 2. Non-interactive: uses --token flag directly (for CI/CD)
 *
 * Tokens are stored in ~/.reskillrc per registry.
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
// Helpers
// ============================================================================

/**
 * Build the token settings page URL for a registry
 */
export function getTokenPageUrl(registry: string): string {
  const base = registry.endsWith('/') ? registry.slice(0, -1) : registry;
  return `${base}/skills/tokens`;
}

const MASK = '••••••••';
const CANCELLED = Symbol('cancelled');

/**
 * Erase N characters behind the cursor and clear to end of line.
 */
function eraseChars(count: number): void {
  process.stdout.write(`\x1b[${count}D\x1b[0K`);
}

/**
 * Read a line from piped stdin (non-TTY).
 */
function readFromPipe(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const onData = (chunk: Buffer) => chunks.push(chunk);
    const onEnd = () => {
      cleanup();
      const value = Buffer.concat(chunks).toString().trim();
      resolve(value || null);
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.removeListener('end', onEnd);
      process.stdin.removeListener('error', onError);
    };

    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
    process.stdin.on('error', onError);
    process.stdin.resume();
  });
}

/**
 * Read token from TTY stdin in raw mode with fixed-length mask feedback.
 *
 * Returns:
 * - token string on valid input + Enter
 * - empty string on empty Enter (no input)
 * - CANCELLED symbol on Ctrl+C
 */
function readFromTTY(): Promise<string | typeof CANCELLED> {
  return new Promise((resolve) => {
    let input = '';
    let masked = false;

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const finish = (value: string | typeof CANCELLED) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeAllListeners('data');
      process.stdout.write('\n');
      resolve(value);
    };

    process.stdin.on('data', (data: string) => {
      for (const ch of data) {
        if (ch === '\r' || ch === '\n') {
          return finish(input.trim());
        }
        if (ch === '\x03') {
          return finish(CANCELLED);
        }
        if (ch === '\x7f' || ch === '\b') {
          // Fixed-length mask can't represent per-char deletion — clear all to let user retry
          if (input.length > 0) {
            input = '';
            if (masked) {
              eraseChars(MASK.length);
              masked = false;
            }
          }
          continue;
        }
        if (ch >= ' ') {
          input += ch;
          if (!masked) {
            process.stdout.write(MASK);
            masked = true;
          }
        }
      }
    });
  });
}

/**
 * Prompt user to paste their access token interactively.
 * Shows a fixed-length mask on input for visual feedback without revealing token length.
 * Retries on empty input, returns null only on explicit cancel (Ctrl+C).
 */
export async function promptForToken(registry: string): Promise<string | null> {
  const tokenPageUrl = getTokenPageUrl(registry);

  logger.newline();
  logger.log(`  Registry: ${registry}`);
  logger.newline();
  logger.log('  To get your access token:');
  logger.log(`    1. Open ${tokenPageUrl}`);
  logger.log('    2. Login and generate an API token');
  logger.log('    3. Copy the token and paste it below');
  logger.newline();

  if (!process.stdin.isTTY) {
    return readFromPipe();
  }

  while (true) {
    process.stdout.write('  Paste your access token: ');
    const result = await readFromTTY();

    if (result === CANCELLED) {
      return null;
    }
    if (result.length > 0) {
      return result;
    }

    logger.warn('  Token cannot be empty. Please try again.');
  }
}

// ============================================================================
// Main Action
// ============================================================================

async function loginAction(options: LoginOptions): Promise<void> {
  const registry = resolveRegistry(options.registry);
  const authManager = new AuthManager();

  let token: string;

  if (options.token) {
    token = options.token;
  } else {
    const prompted = await promptForToken(registry);
    if (!prompted) {
      logger.warn('Login cancelled');
      process.exit(0);
    }
    token = prompted;
  }

  await loginWithToken(token, registry, authManager);
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

  const client = new RegistryClient({ registry, token });

  try {
    const response = await client.loginCli();

    if (!response.success || !response.user) {
      logger.error(response.error || 'Token verification failed');
      process.exit(1);
    }

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
  .option('-t, --token <token>', 'API token from Web UI (skips interactive prompt)')
  .action(loginAction);

export default loginCommand;
