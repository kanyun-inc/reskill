---
"reskill": minor
---

Add `-a/--agent` option to `list` command

`reskill list -a <agent>` now lists skills installed to a specific agent directory. For `claude-cowork-3p`, this implicitly uses global scope since that agent always installs to a global app-managed directory.

---

为 `list` 命令新增 `-a/--agent` 选项

`reskill list -a <agent>` 可列出安装到指定 agent 目录的 skill。对于 `claude-cowork-3p`，会隐式使用全局作用域，因为该 agent 始终安装到全局的应用管理目录。
