import { Command } from 'commander';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { SkillManager } from '../../core/skill-manager.js';
import { ConfigLoader } from '../../core/config-loader.js';
import {
  agents,
  detectInstalledAgents,
  type AgentType,
} from '../../core/agent-registry.js';
import type { InstallMode } from '../../core/installer.js';
import { shortenPath } from '../../utils/fs.js';

/**
 * 格式化 agent 名称列表
 */
function formatAgentNames(agentTypes: AgentType[], maxShow = 5): string {
  const names = agentTypes.map((a) => agents[a].displayName);
  if (names.length <= maxShow) {
    return names.join(', ');
  }
  const shown = names.slice(0, maxShow);
  const remaining = names.length - maxShow;
  return `${shown.join(', ')} +${remaining} more`;
}

/**
 * install 命令 - 安装 skill
 *
 * 支持多种安装模式:
 * - 项目安装 (默认): 安装到项目目录
 * - 全局安装 (-g): 安装到用户目录
 * - 多 Agent 安装 (-a): 安装到指定 agents
 *
 * 交互式流程:
 * 1. 检测已安装的 agents
 * 2. 选择目标 agents（多选）
 * 3. 选择安装范围 (项目/全局)
 * 4. 选择安装方式 (symlink/copy)
 * 5. 确认并执行
 */
export const installCommand = new Command('install')
  .alias('i')
  .description('Install a skill or all skills from skills.json')
  .argument(
    '[skill]',
    'Skill reference (e.g., github:user/skill@v1.0.0 or git@github.com:user/repo.git)'
  )
  .option('-f, --force', 'Force reinstall even if already installed')
  .option('-g, --global', 'Install globally to user home directory')
  .option('--no-save', 'Do not save to skills.json')
  .option(
    '-a, --agent <agents...>',
    'Specify target agents (e.g., cursor, claude-code)'
  )
  .option('--mode <mode>', 'Installation mode: symlink or copy')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('--all', 'Install to all agents (implies -y -g)')
  .action(async (skill, options) => {
    // --all 自动开启 yes 和 global
    if (options.all) {
      options.yes = true;
      options.global = true;
    }

    const skipConfirm = options.yes || false;
    const configLoader = new ConfigLoader();
    const allAgentTypes = Object.keys(agents) as AgentType[];

    // 打印 banner
    console.log();
    p.intro(chalk.bgCyan.black(' reskill '));

    try {
      const spinner = p.spinner();

      // ========================================
      // Step 1: 解析目标 agents
      // ========================================
      let targetAgents: AgentType[];

      if (options.all) {
        // --all: 安装到所有 agents
        targetAgents = allAgentTypes;
        p.log.info(
          `Installing to all ${chalk.cyan(targetAgents.length)} agents`
        );
      } else if (options.agent && options.agent.length > 0) {
        // -a: 指定 agents
        const validAgents = Object.keys(agents);
        const invalidAgents = options.agent.filter(
          (a: string) => !validAgents.includes(a)
        );

        if (invalidAgents.length > 0) {
          p.log.error(`Invalid agents: ${invalidAgents.join(', ')}`);
          p.log.info(`Valid agents: ${validAgents.join(', ')}`);
          process.exit(1);
        }

        targetAgents = options.agent as AgentType[];
        p.log.info(`Installing to: ${formatAgentNames(targetAgents)}`);
      } else {
        // 自动检测已安装的 agents
        spinner.start('Detecting installed agents...');
        const installedAgents = await detectInstalledAgents();
        spinner.stop(
          `Detected ${chalk.green(installedAgents.length)} agent${installedAgents.length !== 1 ? 's' : ''}`
        );

        if (installedAgents.length === 0) {
          if (skipConfirm) {
            targetAgents = allAgentTypes;
            p.log.info('Installing to all agents (none detected)');
          } else {
            p.log.warn(
              'No coding agents detected. You can still install skills.'
            );

            // 让用户选择要安装的 agents
            const allAgentChoices = Object.entries(agents).map(
              ([key, config]) => ({
                value: key as AgentType,
                label: config.displayName,
              })
            );

            const selected = await p.multiselect({
              message: 'Select agents to install skills to',
              options: allAgentChoices,
              required: true,
              initialValues: allAgentTypes,
            });

            if (p.isCancel(selected)) {
              p.cancel('Installation cancelled');
              process.exit(0);
            }

            targetAgents = selected as AgentType[];
          }
        } else if (installedAgents.length === 1 || skipConfirm) {
          // 只有一个 agent 或者跳过确认，直接使用检测到的
          targetAgents = installedAgents;
          if (installedAgents.length === 1) {
            p.log.info(
              `Installing to: ${chalk.cyan(agents[installedAgents[0]].displayName)}`
            );
          } else {
            p.log.info(
              `Installing to: ${installedAgents.map((a) => chalk.cyan(agents[a].displayName)).join(', ')}`
            );
          }
        } else {
          // 多个 agents，让用户选择
          const agentChoices = installedAgents.map((a) => ({
            value: a,
            label: agents[a].displayName,
            hint: agents[a].skillsDir,
          }));

          const selected = await p.multiselect({
            message: 'Select agents to install skills to',
            options: agentChoices,
            required: true,
            initialValues: installedAgents,
          });

          if (p.isCancel(selected)) {
            p.cancel('Installation cancelled');
            process.exit(0);
          }

          targetAgents = selected as AgentType[];
        }
      }

      // ========================================
      // Step 2: 选择安装范围
      // ========================================
      let installGlobally = options.global ?? false;

      if (options.global === undefined && !skipConfirm) {
        const scope = await p.select({
          message: 'Installation scope',
          options: [
            {
              value: false,
              label: 'Project',
              hint: 'Install in current directory (committed with your project)',
            },
            {
              value: true,
              label: 'Global',
              hint: 'Install in home directory (available across all projects)',
            },
          ],
        });

        if (p.isCancel(scope)) {
          p.cancel('Installation cancelled');
          process.exit(0);
        }

        installGlobally = scope as boolean;
      }

      // ========================================
      // Step 3: 选择安装方式
      // ========================================
      let installMode: InstallMode = options.mode || 'symlink';

      if (!options.mode && !skipConfirm) {
        const modeChoice = await p.select({
          message: 'Installation method',
          options: [
            {
              value: 'symlink',
              label: 'Symlink (Recommended)',
              hint: 'Single source of truth, easy updates',
            },
            {
              value: 'copy',
              label: 'Copy to all agents',
              hint: 'Independent copies for each agent',
            },
          ],
        });

        if (p.isCancel(modeChoice)) {
          p.cancel('Installation cancelled');
          process.exit(0);
        }

        installMode = modeChoice as InstallMode;
      }

      // 创建 SkillManager
      const skillManager = new SkillManager(undefined, { global: installGlobally });
      const cwd = process.cwd();

      // ========================================
      // 安装逻辑
      // ========================================
      if (!skill) {
        // Install all from skills.json
        if (installGlobally) {
          p.log.error(
            'Cannot install all skills globally. Please specify a skill to install.'
          );
          process.exit(1);
        }

        if (!configLoader.exists()) {
          p.log.error("skills.json not found. Run 'reskill init' first.");
          process.exit(1);
        }

        const skills = configLoader.getSkills();
        if (Object.keys(skills).length === 0) {
          p.log.info('No skills defined in skills.json');
          p.outro('Done');
          return;
        }

        // 显示安装摘要
        const summaryLines: string[] = [];
        summaryLines.push(
          `${chalk.cyan(Object.keys(skills).length)} skill(s) → ${chalk.cyan(targetAgents.length)} agent(s)`
        );
        summaryLines.push(
          `${chalk.dim('Scope:')} ${installGlobally ? 'Global (~/)' : 'Project (./)'}${chalk.dim(', Mode:')} ${installMode}`
        );

        p.note(summaryLines.join('\n'), 'Installation Summary');

        if (!skipConfirm) {
          const confirmed = await p.confirm({
            message: 'Proceed with installation?',
          });

          if (p.isCancel(confirmed) || !confirmed) {
            p.cancel('Installation cancelled');
            process.exit(0);
          }
        }

        spinner.start('Installing skills...');

        let totalInstalled = 0;
        let totalFailed = 0;

        for (const [name, ref] of Object.entries(skills)) {
          try {
            const { results } = await skillManager.installToAgents(
              ref,
              targetAgents,
              {
                force: options.force,
                save: false,
                mode: installMode,
              }
            );

            const successCount = Array.from(results.values()).filter(
              (r) => r.success
            ).length;
            totalInstalled += successCount;
            totalFailed += results.size - successCount;
          } catch (error) {
            p.log.error(`Failed to install ${name}: ${(error as Error).message}`);
            totalFailed += targetAgents.length;
          }
        }

        spinner.stop('Installation complete');

        // 显示结果
        if (totalFailed === 0) {
          p.log.success(
            `Installed ${chalk.green(Object.keys(skills).length)} skill(s) to ${chalk.green(targetAgents.length)} agent(s)`
          );
        } else {
          p.log.warn(
            `Installed ${chalk.green(totalInstalled)} successfully, ${chalk.red(totalFailed)} failed`
          );
        }
      } else {
        // Install single skill

        // 显示安装摘要
        const summaryLines: string[] = [];
        summaryLines.push(`${chalk.cyan(skill)}`);
        summaryLines.push(`  ${chalk.dim('→')} ${formatAgentNames(targetAgents)}`);
        summaryLines.push(
          `  ${chalk.dim('Scope:')} ${installGlobally ? 'Global' : 'Project'}${chalk.dim(', Mode:')} ${installMode}`
        );

        p.note(summaryLines.join('\n'), 'Installation Summary');

        if (!skipConfirm) {
          const confirmed = await p.confirm({
            message: 'Proceed with installation?',
          });

          if (p.isCancel(confirmed) || !confirmed) {
            p.cancel('Installation cancelled');
            process.exit(0);
          }
        }

        spinner.start(`Installing ${skill}...`);

        const { skill: installed, results } = await skillManager.installToAgents(
          skill,
          targetAgents,
          {
            force: options.force,
            save: options.save && !installGlobally,
            mode: installMode,
          }
        );

        spinner.stop('Installation complete');

        // 统计结果
        const successful = Array.from(results.entries()).filter(
          ([, r]) => r.success
        );
        const failed = Array.from(results.entries()).filter(
          ([, r]) => !r.success
        );
        const symlinkFailed = successful.filter(
          ([, r]) => r.mode === 'symlink' && r.symlinkFailed
        );

        // 显示成功信息
        if (successful.length > 0) {
          const resultLines: string[] = [];
          const firstResult = successful[0][1];

          if (firstResult.mode === 'copy') {
            resultLines.push(
              `${chalk.green('✓')} ${installed.name}@${installed.version} ${chalk.dim('(copied)')}`
            );
            for (const [, result] of successful) {
              const shortPath = shortenPath(result.path, cwd);
              resultLines.push(`  ${chalk.dim('→')} ${shortPath}`);
            }
          } else {
            // Symlink mode
            if (firstResult.canonicalPath) {
              const shortPath = shortenPath(firstResult.canonicalPath, cwd);
              resultLines.push(`${chalk.green('✓')} ${shortPath}`);
            } else {
              resultLines.push(
                `${chalk.green('✓')} ${installed.name}@${installed.version}`
              );
            }

            const symlinked = successful
              .filter(([, r]) => !r.symlinkFailed)
              .map(([a]) => agents[a].displayName);
            const copied = successful
              .filter(([, r]) => r.symlinkFailed)
              .map(([a]) => agents[a].displayName);

            if (symlinked.length > 0) {
              resultLines.push(
                `  ${chalk.dim('symlink →')} ${symlinked.join(', ')}`
              );
            }
            if (copied.length > 0) {
              resultLines.push(
                `  ${chalk.yellow('copied →')} ${copied.join(', ')}`
              );
            }
          }

          const title = chalk.green(
            `Installed 1 skill to ${successful.length} agent${successful.length !== 1 ? 's' : ''}`
          );
          p.note(resultLines.join('\n'), title);

          // Symlink 失败警告
          if (symlinkFailed.length > 0) {
            const copiedAgentNames = symlinkFailed.map(
              ([a]) => agents[a].displayName
            );
            p.log.warn(
              chalk.yellow(`Symlinks failed for: ${copiedAgentNames.join(', ')}`)
            );
            p.log.message(
              chalk.dim(
                '  Files were copied instead. On Windows, enable Developer Mode for symlink support.'
              )
            );
          }
        }

        // 显示失败信息
        if (failed.length > 0) {
          p.log.error(chalk.red(`Failed to install to ${failed.length} agent(s)`));
          for (const [agent, result] of failed) {
            p.log.message(
              `  ${chalk.red('✗')} ${agents[agent].displayName}: ${chalk.dim(result.error)}`
            );
          }
        }
      }

      console.log();
      p.outro(chalk.green('Done!'));
    } catch (error) {
      p.log.error((error as Error).message);
      p.outro(chalk.red('Installation failed'));
      process.exit(1);
    }
  });

export default installCommand;
