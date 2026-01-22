import { Command } from 'commander';
import { ConfigLoader } from '../../core/config-loader.js';
import { logger } from '../../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

interface InitOptions {
  /** Skills installation directory */
  installDir: string;
  /** Skip prompts and use defaults */
  yes?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_INSTALL_DIR = '.skills';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Display configuration summary after initialization
 */
function displayConfigSummary(installDir: string): void {
  logger.success('Created skills.json');
  logger.newline();
  logger.log('Configuration:');
  logger.log(`  Install directory: ${installDir}`);
  logger.newline();
  logger.log('Next steps:');
  logger.log('  reskill install <skill>  Install a skill');
  logger.log('  reskill list             List installed skills');
}

// ============================================================================
// Command Definition
// ============================================================================

/**
 * init command - Initialize skills.json configuration
 *
 * Creates a new skills.json file in the current directory with default settings.
 * Will not overwrite an existing skills.json file.
 *
 * @example
 * ```bash
 * # Initialize with defaults
 * reskill init
 *
 * # Initialize with custom install directory
 * reskill init -d my-skills
 *
 * # Skip prompts (for CI/scripts)
 * reskill init -y
 * ```
 */
export const initCommand = new Command('init')
  .description('Initialize a new skills.json configuration')
  .option('-d, --install-dir <dir>', 'Skills installation directory', DEFAULT_INSTALL_DIR)
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action((options: InitOptions) => {
    const configLoader = new ConfigLoader();

    // Check if configuration already exists
    if (configLoader.exists()) {
      logger.warn('skills.json already exists');
      return;
    }

    // Create new configuration
    configLoader.create({
      defaults: {
        installDir: options.installDir,
      },
    });

    // Display summary (use options.installDir directly since we just set it)
    displayConfigSummary(options.installDir);
  });

export default initCommand;
