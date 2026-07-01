---
"reskill": minor
---

feat(core): persist source metadata for global installs and support `update -g`

- Write `.reskill-source.json` in each skill directory during global installs (`-g`, `--no-save`, `--skip-manifest`, claude-3p), recording source, version, and registry URL
- `outdated -g` reads `.reskill-source.json` first (skipping slow probe), and writes it back after a successful probe for old installs (progressive migration)
- Add `-g, --global` flag to `update` command, enabling single (`update -g <name>`) and batch (`update -g`) updates for globally installed skills
- Skills without source metadata are skipped with a helpful message

---

feat(core): 为全局安装持久化来源元数据，支持 `update -g`

- 全局安装（`-g`、`--no-save`、`--skip-manifest`、claude-3p）时在 skill 目录下写入 `.reskill-source.json`，记录来源、版本和 registry URL
- `outdated -g` 优先读取 `.reskill-source.json`（跳过慢速探测），对老安装在探测成功后自动回写（渐进式迁移）
- `update` 命令新增 `-g, --global` 参数，支持单个（`update -g <name>`）和批量（`update -g`）更新全局 skill
- 无来源元数据的 skill 跳过并给出提示
