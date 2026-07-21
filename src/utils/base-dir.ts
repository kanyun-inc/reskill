/**
 * Base directory resolution for the --base-dir option
 *
 * `--base-dir` overrides the root that project-level operations resolve
 * against. skills.json, skills.lock, and every agent's skills directory all
 * derive from the same project root, so a single flag relocates a complete
 * skill set into an arbitrary directory.
 *
 * This enables per-instance isolation: a host that manages several agent
 * definitions side by side can give each one its own directory and install
 * into them independently.
 */

import path from 'node:path';
import { exists, isDirectory } from './fs.js';
import { logger } from './logger.js';

/**
 * Resolve a --base-dir value into an absolute directory path.
 *
 * Returns undefined when the option was not supplied, letting callers keep
 * their existing process.cwd() behavior.
 *
 * The directory must already exist. Creating it on demand would turn a typo
 * into an empty skill set that only fails much later, far away from the
 * mistake that caused it.
 *
 * @param baseDir Raw option value, or undefined when not supplied
 * @param options.global Whether the command also received --global
 * @throws When the value is empty, missing, not a directory, or combined
 *   with --global
 */
export function resolveBaseDir(
  baseDir: string | undefined,
  options: { global?: boolean } = {},
): string | undefined {
  if (baseDir === undefined) {
    return undefined;
  }

  if (options.global) {
    throw new Error(
      '--base-dir cannot be combined with --global: global installs always resolve to the user home directory',
    );
  }

  const trimmed = baseDir.trim();
  if (trimmed === '') {
    throw new Error('--base-dir requires a non-empty directory path');
  }

  const resolved = path.resolve(process.cwd(), trimmed);

  if (!exists(resolved)) {
    throw new Error(`--base-dir directory not found: ${resolved}`);
  }

  if (!isDirectory(resolved)) {
    throw new Error(`--base-dir must point to a directory: ${resolved}`);
  }

  return resolved;
}

/**
 * Resolve --base-dir, reporting failures as a CLI error instead of throwing.
 *
 * For commands whose action has no surrounding error handling, an uncaught
 * throw would surface as a stack trace. This keeps the failure consistent
 * with how those commands report every other usage error.
 */
export function resolveBaseDirOrExit(
  baseDir: string | undefined,
  options: { global?: boolean } = {},
): string | undefined {
  try {
    return resolveBaseDir(baseDir, options);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/** Shared description for the --base-dir option across commands */
export const BASE_DIR_OPTION_DESCRIPTION =
  'Project root to resolve skills.json, skills.lock and agent skill directories against (default: current directory)';
