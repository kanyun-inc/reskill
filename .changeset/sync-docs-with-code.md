---
"reskill": patch
---

Sync documentation with latest code

**Changes:**
- Updated Multi-Agent support table from 6 to 17 agents across README.md, README.zh-CN.md, and SKILL.md
- Fixed Common Options table: `--token`, `--registry`, `--json` now list all commands that actually support them
- Added missing `group` command and `search` alias for `find` in SKILL.md
- Added missing `--limit` and `--skip-network` options to SKILL.md
- Added `VERBOSE` environment variable to SKILL.md
- Fixed `completion` command format from `completion install` to `completion [action]`
- Updated publish description: metadata now comes from SKILL.md frontmatter, not a separate skill.json
- Bumped reskill-usage skill version to 0.1.3

---

同步文档与最新代码

**变更：**
- Multi-Agent 支持表从 6 个更新至 17 个 Agent（README.md、README.zh-CN.md、SKILL.md）
- 修正常用选项表：`--token`、`--registry`、`--json` 现在列出了所有实际支持的命令
- SKILL.md 补充缺失的 `group` 命令和 `find` 的 `search` 别名
- SKILL.md 补充缺失的 `--limit` 和 `--skip-network` 选项
- SKILL.md 补充 `VERBOSE` 环境变量
- 修正 `completion` 命令格式为 `completion [action]`
- 更新发布说明：元数据来源从 skill.json 改为 SKILL.md frontmatter
- reskill-usage skill 版本号更新至 0.1.3
