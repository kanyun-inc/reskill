---
"reskill": minor
---

Support installing selected skills from multi-skill repositories with `--skill` and `--list`

**New Features:**
- `reskill install <repo> --skill <name>` — Install one specific skill by name from a multi-skill repository
- `reskill install <repo> --skill <name1> <name2>` — Install multiple named skills from a single repo
- `reskill install <repo> --list` — Discover and list all available skills in a repository without installing
- Skills from multi-skill repos are saved to `skills.json` using `ref#skillName` format (e.g. `github:org/repo@v1.0.0#pdf`)

**Core Changes:**
- `skill-parser.ts`: Add `discoverSkillsInDir()` for scanning SKILL.md files with priority directories (`skills/`, `.agents/skills/`, etc.) and recursive fallback (max depth 5, skip `node_modules`/`.git`/`dist`)
- `skill-parser.ts`: Add `filterSkillsByName()` for case-insensitive skill name matching
- `skill-manager.ts`: Add `installSkillsFromRepo()` method with Git-only flow, discriminated union return type (`listOnly: true` for discovery, `listOnly: false` for installation), skip-if-installed logic, and skipped skill tracking
- `install.ts`: Add `installMultiSkillFromRepo()` CLI handler with installation summary, confirmation prompt, and result display

**Bug Fixes & Improvements:**
- Use discriminated union properly in `--list` path (type-safe access to `result.skills`)
- Forward `--force` option with skip-if-installed check; only skip when exact same ref is locked
- Show meaningful message when all skills are already installed (with skip reasons)
- Warn when `--skill`/`--list` used with multiple refs (flags are ignored in that case)
- Replace `console.log()` with `p.log.message('')` for consistent `@clack/prompts` formatting
- Optimize recursive discovery: track visited directories to avoid redundant I/O and symlink cycles
- Add `try/catch` around `fs.statSync` in priority directory scan for race condition safety

**Spec & Tests:**
- Update `docs/cli-spec.md` with `--skill` and `--list` option behavior, multi-skill repo section, and scenario tables
- Add integration tests: `--list`, `--skill` single/multiple, error when skill not found, `--force`, `--no-save`, `-a cursor -y`, `--help`
- Add unit tests: `discoverSkillsInDir` (root, priority dirs, recursive, dedup, skip node_modules), `filterSkillsByName`, `installSkillsFromRepo` (list, filter, save, error, no SKILL.md)

---

支持从多技能仓库中选择性安装技能（`--skill` 和 `--list`）

**新功能：**
- `reskill install <repo> --skill <name>` — 从多技能仓库中按名称安装指定技能
- `reskill install <repo> --skill <name1> <name2>` — 从单个仓库安装多个指定技能
- `reskill install <repo> --list` — 发现并列出仓库中所有可用技能，不执行安装
- 多技能仓库中的技能以 `ref#skillName` 格式保存到 `skills.json`（如 `github:org/repo@v1.0.0#pdf`）

**核心变更：**
- `skill-parser.ts`：新增 `discoverSkillsInDir()` 用于扫描 SKILL.md 文件，支持优先目录（`skills/`、`.agents/skills/` 等）和递归回退（最大深度 5，跳过 `node_modules`/`.git`/`dist`）
- `skill-parser.ts`：新增 `filterSkillsByName()` 用于大小写不敏感的技能名称匹配
- `skill-manager.ts`：新增 `installSkillsFromRepo()` 方法，使用 Git-only 流程、判别联合返回类型、跳过已安装逻辑和跳过技能跟踪
- `install.ts`：新增 `installMultiSkillFromRepo()` CLI 处理函数，含安装摘要、确认提示和结果展示

**Bug 修复与改进：**
- 在 `--list` 路径中正确使用判别联合（类型安全地访问 `result.skills`）
- 传递 `--force` 选项并添加跳过已安装检查；仅在完全相同 ref 已锁定时跳过
- 所有技能已安装时显示有意义的提示信息（包含跳过原因）
- 当 `--skill`/`--list` 与多个 ref 同时使用时发出警告
- 将 `console.log()` 替换为 `p.log.message('')`，统一格式化
- 优化递归发现：跟踪已访问目录避免冗余 I/O 和 symlink 循环
- 在优先目录扫描的 `fs.statSync` 中添加 `try/catch` 防止竞态条件

**规范与测试：**
- 更新 `docs/cli-spec.md`，添加 `--skill` 和 `--list` 选项行为、多技能仓库章节和场景表格
- 添加集成测试：`--list`、`--skill` 单个/多个、技能未找到错误、`--force`、`--no-save`、`-a cursor -y`、`--help`
- 添加单元测试：`discoverSkillsInDir`（根目录、优先目录、递归、去重、跳过 node_modules）、`filterSkillsByName`、`installSkillsFromRepo`（列表、过滤、保存、错误、无 SKILL.md）
