---
"reskill": minor
---

feat(cli): add `--base-dir` to relocate the project root

- New `--base-dir <dir>` option on `install`, `list`, `update`, `outdated` and `uninstall`. It overrides the project root that project-level operations resolve against, so `skills.json`, `skills.lock` and every target agent's skills directory move together — `--base-dir agents/foo -a claude-code cursor` reads `agents/foo/skills.json` and installs into `agents/foo/.claude/skills` and `agents/foo/.cursor/skills`
- This makes per-instance isolation possible: several agent definitions can live side by side under one parent directory, each with an independent skill set, without the current working directory or `~/.claude/skills` being shared between them. Previously the only options were the current directory (project-level) or the user home directory (`-g`), and neither could express "this agent's own skill set"
- The underlying `SkillManager`/`ConfigLoader`/`getAgentSkillsDir` already accepted a project root; the CLI simply never exposed it. No path-resolution logic was changed, so default behavior without the flag is unchanged
- Validation: the directory must already exist (creating it on demand would turn a typo into an empty skill set that fails much later), must be a directory rather than a file, and cannot be combined with `-g/--global`, which always resolves to the user home directory. All failures exit with code 1
- Note: the global cache is not concurrency-safe, so multiple roots should be installed sequentially. This is a pre-existing limitation tracked separately

---

feat(cli): 新增 `--base-dir` 参数，可重定向项目根目录

- 在 `install`、`list`、`update`、`outdated`、`uninstall` 上新增 `--base-dir <dir>` 参数。它覆盖项目级操作所基于的项目根目录，`skills.json`、`skills.lock` 与各目标 agent 的 skills 目录会一起迁移——`--base-dir agents/foo -a claude-code cursor` 会读取 `agents/foo/skills.json`，并安装到 `agents/foo/.claude/skills` 和 `agents/foo/.cursor/skills`
- 这使得按实例隔离成为可能：多个 agent 定义可以并存于同一个父目录下，各自拥有独立的 skill 集合，既不共享当前工作目录，也不共享 `~/.claude/skills`。此前只有当前目录（项目级）和用户主目录（`-g`）两个选择，都无法表达"这个 agent 自己的 skill 集合"
- 底层的 `SkillManager`/`ConfigLoader`/`getAgentSkillsDir` 本就接受项目根目录参数，只是 CLI 从未暴露出来。本次未改动任何路径解析逻辑，不带该参数时行为完全不变
- 参数校验：目录必须已存在（若按需创建，一个笔误会变成空的 skill 集合，问题要到很久之后才暴露）、必须是目录而非文件、且不能与 `-g/--global` 同时使用（全局安装始终解析到用户主目录）。所有校验失败均以退出码 1 结束
- 注意：全局缓存并非并发安全，多个根目录应串行安装。这是既有限制，另行跟踪
