---
"reskill": minor
---

Add `-a/--agent` option to `list` command and include claude-cowork-3p in global listing

`reskill list -a <agent>` now lists skills installed to a specific agent directory. For `claude-cowork-3p`, this implicitly uses global scope since that agent always installs to a global app-managed directory.

`reskill list --global` now also includes skills installed to claude-cowork-3p, since they are effectively global.

---

为 `list` 命令新增 `-a/--agent` 选项，并在全局列表中包含 claude-cowork-3p

`reskill list -a <agent>` 可列出安装到指定 agent 目录的 skill。对于 `claude-cowork-3p`，会隐式使用全局作用域，因为该 agent 始终安装到全局的应用管理目录。

`reskill list --global` 现在也会列出安装到 claude-cowork-3p 的 skill，因为它们本质上是全局安装的。
