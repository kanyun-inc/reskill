#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../utils/logger.js';
import { checkForUpdate, formatUpdateMessage } from '../utils/update-notifier.js';
import {
  completionCommand,
  doctorCommand,
  infoCommand,
  initCommand,
  installCommand,
  listCommand,
  maybeHandleCompletion,
  outdatedCommand,
  uninstallCommand,
  updateCommand,
} from './commands/index.js';

// Handle tab completion early (before commander parsing)
// This is needed because tabtab expects to intercept the process early
if (maybeHandleCompletion()) {
  process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

const program = new Command();

program
  .name('reskill')
  .description('AI Skills Package Manager - Git-based skills management for AI agents')
  .version(packageJson.version);

// Register all commands
program.addCommand(initCommand);
program.addCommand(installCommand);
program.addCommand(listCommand);
program.addCommand(infoCommand);
program.addCommand(updateCommand);
program.addCommand(outdatedCommand);
program.addCommand(uninstallCommand);
program.addCommand(completionCommand);
program.addCommand(doctorCommand);

// Start update check in background (non-blocking)
const updateCheckPromise = checkForUpdate(packageJson.name, packageJson.version);

// Parse arguments and wait for async commands to complete
program.parseAsync().then(async () => {
  // After command execution, show update notification if available
  const result = await updateCheckPromise;
  if (result?.hasUpdate) {
    logger.log(formatUpdateMessage(result));
  }
});
