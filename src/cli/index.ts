#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import {
  infoCommand,
  initCommand,
  installCommand,
  linkCommand,
  listCommand,
  outdatedCommand,
  uninstallCommand,
  unlinkCommand,
  updateCommand,
} from './commands/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8'),
);

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
program.addCommand(linkCommand);
program.addCommand(unlinkCommand);

// Parse arguments
program.parse();
