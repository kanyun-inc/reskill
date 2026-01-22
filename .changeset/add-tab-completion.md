---
"reskill": minor
---

Add shell tab completion support for bash, zsh, and fish.

New features:
- `reskill completion install` - Install shell completion interactively
- `reskill completion uninstall` - Remove shell completion
- Subcommand completion: `reskill <Tab>` shows all available commands
- Skill name completion for `info`, `uninstall`, `update` commands
- Linked skill completion for `unlink` command
- Option completion for `install -<Tab>` (shows -f, -g, -a, --force, etc.)
- Agent name completion for `install -a <Tab>`

---

新增 Shell Tab 补全功能，支持 bash、zsh 和 fish。

新功能：
- `reskill completion install` - 交互式安装 Shell 补全
- `reskill completion uninstall` - 卸载 Shell 补全
- 子命令补全：`reskill <Tab>` 显示所有可用命令
- skill 名称补全：`info`、`uninstall`、`update` 命令支持补全已安装的 skill
- 已链接 skill 补全：`unlink` 命令只补全已链接的 skill
- 选项补全：`install -<Tab>` 显示 -f、-g、-a、--force 等选项
- agent 名称补全：`install -a <Tab>` 补全 agent 名称
