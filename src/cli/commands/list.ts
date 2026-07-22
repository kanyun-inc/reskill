import { Command } from 'commander';
import { type AgentType, getAgentConfig, isValidAgentType } from '../../core/agent-registry.js';
import { CLAUDE_COWORK_3P_AGENT } from '../../core/claude-3p-installer.js';
import { SkillManager } from '../../core/skill-manager.js';
import { BASE_DIR_OPTION_DESCRIPTION, resolveBaseDirOrExit } from '../../utils/base-dir.js';
import { logger } from '../../utils/logger.js';

/**
 * list command - List installed skills
 */
export const listCommand = new Command('list')
  .alias('ls')
  .description('List installed skills')
  .option('-j, --json', 'Output as JSON')
  .option('-g, --global', 'List globally installed skills')
  .option('-a, --agent <agent>', 'List skills installed to a specific agent')
  .option('--base-dir <dir>', BASE_DIR_OPTION_DESCRIPTION)
  .action((options) => {
    const agentInput: string | undefined = options.agent;

    if (agentInput !== undefined && !isValidAgentType(agentInput)) {
      logger.error(`Invalid agent: ${agentInput}`);
      process.exit(1);
    }

    const agent = agentInput as AgentType | undefined;

    // claude-cowork-3p is always global
    const isGlobal = options.global || agent === CLAUDE_COWORK_3P_AGENT;
    const baseDir = resolveBaseDirOrExit(options.baseDir, { global: isGlobal });
    const skillManager = new SkillManager(baseDir, { global: isGlobal });
    const skills = skillManager.list(agent ? { agent } : undefined);

    if (skills.length === 0) {
      const location = agent
        ? `for ${getAgentConfig(agent).displayName}`
        : isGlobal
          ? 'globally'
          : 'in this project';
      logger.info(`No skills installed ${location}`);
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(skills, null, 2));
      return;
    }

    const scopeLabel = agent ? getAgentConfig(agent).displayName : isGlobal ? 'global' : 'project';
    logger.log(`Installed Skills (${scopeLabel}):`);
    logger.newline();

    const headers = ['Name', 'Version', 'Source', 'Agents'];
    const rows = skills.map((skill) => [
      skill.name,
      skill.isLinked ? `${skill.version} (linked)` : skill.version,
      skill.source || '-',
      skill.agents?.length
        ? skill.agents.map((a) => getAgentConfig(a).displayName).join(', ')
        : '-',
    ]);

    logger.table(headers, rows);
    logger.newline();
    logger.log(`Total: ${skills.length} skill(s)`);
  });

export default listCommand;
