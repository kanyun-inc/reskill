import * as p from '@clack/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import { type AgentType, agents } from '../../core/agent-registry.js';
import { ConfigLoader } from '../../core/config-loader.js';
import { Installer } from '../../core/installer.js';
import { SkillManager } from '../../core/skill-manager.js';

/**
 * uninstall command - Uninstall one or more skills
 */
export const uninstallCommand = new Command('uninstall')
  .alias('un')
  .alias('remove')
  .alias('rm')
  .description('Uninstall one or more skills')
  .argument('<skills...>', 'Skill names to uninstall')
  .option('-g, --global', 'Uninstall from global installation (~/.claude/skills)')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (skillNames: string[], options) => {
    const isGlobal = options.global || false;
    const skipConfirm = options.yes || false;
    const skillManager = new SkillManager(undefined, { global: isGlobal });

    console.log();
    p.intro(chalk.bgCyan.black(' reskill '));

    // Check which agents have these skills installed
    // Use installDir from config to match where skills are actually installed
    const config = new ConfigLoader(process.cwd());
    const defaults = config.getDefaults();
    const installer = new Installer({
      cwd: process.cwd(),
      global: isGlobal,
      installDir: defaults.installDir,
    });

    const allAgentTypes = Object.keys(agents) as AgentType[];

    // Collect info for all skills
    type SkillInfo = {
      name: string;
      installedAgents: AgentType[];
      isInCanonical: boolean;
    };
    const skillsToUninstall: SkillInfo[] = [];
    const notInstalledSkills: string[] = [];

    for (const skillName of skillNames) {
      const installedAgents = allAgentTypes.filter((agent) =>
        installer.isInstalled(skillName, agent),
      );
      const isInCanonical = installer.isInstalledInCanonical(skillName);

      if (installedAgents.length === 0 && !isInCanonical) {
        notInstalledSkills.push(skillName);
      } else {
        skillsToUninstall.push({ name: skillName, installedAgents, isInCanonical });
      }
    }

    // Warn about skills that are not installed
    for (const skillName of notInstalledSkills) {
      const location = isGlobal ? '(global)' : '';
      p.log.warn(`Skill ${chalk.cyan(skillName)} is not installed ${location}`.trim());
    }

    if (skillsToUninstall.length === 0) {
      p.outro('Done');
      process.exit(0);
    }

    // Show uninstallation summary
    const summaryLines: string[] = [];
    for (const skill of skillsToUninstall) {
      summaryLines.push(`${chalk.cyan(skill.name)}`);
      const agentNames = skill.installedAgents.map((a) => agents[a].displayName).join(', ');
      if (agentNames) {
        summaryLines.push(`  ${chalk.dim('→')} ${agentNames}`);
      }
      if (skill.isInCanonical && skill.installedAgents.length === 0) {
        summaryLines.push(`  ${chalk.dim('→')} Canonical location only`);
      }
      summaryLines.push(`  ${chalk.dim('Scope:')} ${isGlobal ? 'Global' : 'Project'}`);
      summaryLines.push('');
    }

    p.note(summaryLines.join('\n').trim(), 'Uninstallation Summary');

    if (!skipConfirm) {
      const confirmed = await p.confirm({
        message: `Proceed with uninstalling ${skillsToUninstall.length} skill(s)?`,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        p.cancel('Uninstallation cancelled');
        process.exit(0);
      }
    }

    // Uninstall all skills
    let totalSuccess = 0;
    let totalFailed = 0;

    for (const skill of skillsToUninstall) {
      // Uninstall from all detected agents (also removes canonical location)
      const results = skillManager.uninstallFromAgents(skill.name, skill.installedAgents);
      const successCount = Array.from(results.values()).filter((r) => r).length;

      // Count canonical removal as success if it was there
      const totalRemoved = successCount + (skill.isInCanonical ? 1 : 0);

      if (totalRemoved > 0) {
        p.log.success(`Uninstalled ${chalk.cyan(skill.name)} from ${successCount} agent(s)`);
        totalSuccess++;
      } else {
        p.log.error(`Failed to uninstall ${chalk.cyan(skill.name)}`);
        totalFailed++;
      }
    }

    console.log();
    if (totalFailed > 0) {
      p.outro(chalk.yellow(`Done with ${totalFailed} failure(s)`));
      process.exit(1);
    } else {
      p.outro(chalk.green('Done!'));
    }
  });

export default uninstallCommand;
