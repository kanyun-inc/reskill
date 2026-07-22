import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { ConfigLoader } from '../../core/config-loader.js';
import { SkillManager } from '../../core/skill-manager.js';
import { BASE_DIR_OPTION_DESCRIPTION, resolveBaseDirOrExit } from '../../utils/base-dir.js';
import { logger } from '../../utils/logger.js';

/**
 * outdated command - Check for outdated skills
 */
export const outdatedCommand = new Command('outdated')
  .description('Check for outdated skills')
  .option('-j, --json', 'Output as JSON')
  .option('-g, --global', 'Check globally installed skills')
  .option('--base-dir <dir>', BASE_DIR_OPTION_DESCRIPTION)
  .action(async (options) => {
    const isGlobal = options.global || false;
    const baseDir = resolveBaseDirOrExit(options.baseDir, { global: isGlobal });

    if (!isGlobal) {
      const configLoader = new ConfigLoader(baseDir);

      if (!configLoader.exists()) {
        logger.error("skills.json not found. Run 'reskill init' first.");
        process.exit(1);
      }

      const skills = configLoader.getSkills();
      if (Object.keys(skills).length === 0) {
        logger.info('No skills defined in skills.json');
        return;
      }
    }

    const skillManager = new SkillManager(baseDir, { global: isGlobal });
    const spinner = ora('Checking for updates...').start();

    try {
      const results = await skillManager.checkOutdated();
      spinner.stop();

      if (results.length === 0) {
        logger.info(isGlobal ? 'No globally installed skills found' : 'No skills to check');
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      const outdated = results.filter((r) => r.updateAvailable);

      if (outdated.length === 0) {
        logger.success('All skills are up to date!');
        return;
      }

      logger.package('Checking for updates...');
      logger.newline();

      const headers = ['Skill', 'Current', 'Latest', 'Status'];
      const rows = results.map((r) => [
        r.name,
        r.current,
        r.latest,
        r.updateAvailable ? chalk.yellow('⬆️ Update available') : chalk.green('✅ Up to date'),
      ]);

      logger.table(headers, rows);
      logger.newline();

      if (outdated.length > 0) {
        logger.log(`Run ${chalk.cyan('reskill update')} to update all skills`);
        logger.log(`Or ${chalk.cyan('reskill update <skill>')} to update a specific skill`);
      }
    } catch (error) {
      spinner.fail('Check failed');
      logger.error((error as Error).message);
      process.exit(1);
    }
  });

export default outdatedCommand;
