import { Command } from 'commander';
import tabtab from 'tabtab';
import { agents, type AgentType } from '../../core/agent-registry.js';
import { SkillManager } from '../../core/skill-manager.js';
import { logger } from '../../utils/logger.js';

/**
 * All available subcommands for reskill
 */
const SUBCOMMANDS = [
  { name: 'install', description: 'Install a skill or all skills from skills.json' },
  { name: 'uninstall', description: 'Uninstall a skill' },
  { name: 'update', description: 'Update installed skills' },
  { name: 'info', description: 'Show skill details' },
  { name: 'list', description: 'List installed skills' },
  { name: 'init', description: 'Initialize skills.json' },
  { name: 'outdated', description: 'Check for outdated skills' },
  { name: 'completion', description: 'Setup shell completion' },
];

/**
 * Commands that need skill name completion
 */
const SKILL_COMPLETION_COMMANDS = ['info', 'uninstall', 'update'];

/**
 * Get all agent type names for completion
 */
function getAgentNames(): string[] {
  return Object.keys(agents) as AgentType[];
}

/**
 * Get installed skill names for completion
 */
function getInstalledSkillNames(): string[] {
  try {
    const skillManager = new SkillManager();
    const skills = skillManager.list();
    return skills.map((s) => s.name);
  } catch {
    return [];
  }
}


/**
 * Handle tab completion
 *
 * This function is called when the shell requests completion.
 * It parses the current command line and returns appropriate completions.
 */
function handleCompletion(): void {
  const env = tabtab.parseEnv(process.env);

  // Not in completion mode
  if (!env.complete) {
    return;
  }

  const { prev, line } = env;

  // Parse the command line to understand context
  const parts = line.trim().split(/\s+/);
  const command = parts[1]; // First word after 'reskill'

  // Completing the subcommand (reskill <TAB>)
  // Only show subcommands if:
  // 1. Only 'reskill' is typed (parts.length === 1)
  // 2. Or typing the subcommand (parts.length === 2 and not ending with space)
  if (parts.length === 1 || (parts.length === 2 && !line.endsWith(' '))) {
    const completions = SUBCOMMANDS.map((c) => ({
      name: c.name,
      description: c.description,
    }));
    tabtab.log(completions);
    return;
  }

  // Completing skill name for info/uninstall commands (only accept ONE skill argument)
  // Only complete if we're at the first argument position (words === 2 means completing 2nd word)
  if (SKILL_COMPLETION_COMMANDS.includes(command)) {
    // parts: ['reskill', 'info', ...args]
    // If already has a skill argument, don't complete more
    if (parts.length > 2 && line.endsWith(' ')) {
      // Already have an argument and user pressed space, no more completions
      tabtab.log([]);
      return;
    }
    if (parts.length > 3) {
      // Already have more than one argument
      tabtab.log([]);
      return;
    }
    const skills = getInstalledSkillNames();
    tabtab.log(skills);
    return;
  }

  // Completing agent names for install -a/--agent
  if (command === 'install' && (prev === '-a' || prev === '--agent')) {
    const agentNames = getAgentNames();
    tabtab.log(agentNames);
    return;
  }

  // Completing options for install command
  // Only show options when user is typing an option (starts with -)
  // Don't auto-complete '-' when user just typed 'install '
  if (command === 'install') {
    const { last } = env;
    
    // Only complete if user has started typing an option (e.g., '-' or '--')
    if (last.startsWith('-')) {
      const options = [
        { name: '-f', description: 'Force reinstall' },
        { name: '--force', description: 'Force reinstall' },
        { name: '-g', description: 'Install globally' },
        { name: '--global', description: 'Install globally' },
        { name: '-a', description: 'Specify target agents' },
        { name: '--agent', description: 'Specify target agents' },
        { name: '-y', description: 'Skip confirmation' },
        { name: '--yes', description: 'Skip confirmation' },
        { name: '--all', description: 'Install to all agents' },
      ];
      tabtab.log(options);
      return;
    }
    
    // After 'install ' with no input, don't suggest anything
    // (user might want to type a skill reference)
    tabtab.log([]);
    return;
  }

  // Default: no completions
  tabtab.log([]);
}

/**
 * completion command - Setup shell completion
 */
export const completionCommand = new Command('completion')
  .description('Setup shell completion for reskill')
  .argument('[action]', 'Action: install, uninstall, or shell name (bash, zsh, fish)')
  .action(async (action?: string) => {
    // Check if we're being called for completion
    const env = tabtab.parseEnv(process.env);
    if (env.complete) {
      handleCompletion();
      return;
    }

    if (!action) {
      // Show help
      logger.log('Shell completion for reskill');
      logger.newline();
      logger.log('Usage:');
      logger.log('  reskill completion install     Install completion (interactive)');
      logger.log('  reskill completion uninstall   Remove completion');
      logger.newline();
      logger.log('Supported shells: bash, zsh, fish');
      logger.newline();
      logger.log('After installation, restart your shell or run:');
      logger.log('  source ~/.bashrc   # for bash');
      logger.log('  source ~/.zshrc    # for zsh');
      return;
    }

    if (action === 'install') {
      try {
        await tabtab.install({
          name: 'reskill',
          completer: 'reskill',
        });
        logger.success('Completion installed successfully!');
        logger.log('Restart your shell or source your shell config file.');
      } catch (error) {
        logger.error(`Failed to install completion: ${(error as Error).message}`);
        process.exit(1);
      }
      return;
    }

    if (action === 'uninstall') {
      try {
        await tabtab.uninstall({
          name: 'reskill',
        });
        logger.success('Completion uninstalled successfully!');
      } catch (error) {
        logger.error(`Failed to uninstall completion: ${(error as Error).message}`);
        process.exit(1);
      }
      return;
    }

    // Unknown action
    logger.error(`Unknown action: ${action}`);
    logger.log('Use "reskill completion install" or "reskill completion uninstall"');
    process.exit(1);
  });

/**
 * Check if completion is being requested and handle it
 *
 * This should be called at the start of CLI execution
 */
export function maybeHandleCompletion(): boolean {
  const env = tabtab.parseEnv(process.env);
  if (env.complete) {
    handleCompletion();
    return true;
  }
  return false;
}

export default completionCommand;
