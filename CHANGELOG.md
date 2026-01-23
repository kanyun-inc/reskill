# reskill

## 0.18.0

### Minor Changes

- 1dff245: Add `doctor` command for environment diagnostics

  **New Command:**

  - `reskill doctor` - Diagnose reskill environment and check for issues
  - `reskill doctor --skip-network` - Skip network connectivity checks (faster)
  - `reskill doctor --json` - Output results as JSON for scripting

  **Checks Performed:**

  | Check              | Description                                         |
  | ------------------ | --------------------------------------------------- |
  | reskill version    | Current version and update availability             |
  | Node.js version    | Requires >=18.0.0                                   |
  | Git                | Git installation and version                        |
  | Git authentication | SSH keys or credential helpers                      |
  | Cache directory    | Cache path, size, and cached skills count           |
  | skills.json        | Configuration file existence and validity           |
  | skills.lock        | Lock file sync status with skills.json              |
  | Installed skills   | Skill integrity with detailed diagnostics           |
  | Config validation  | Registry conflicts, dangerous paths, invalid agents |
  | Network            | GitHub and GitLab connectivity                      |

  **Installed Skills Detailed Diagnostics:**

  - Missing both `skill.json` and `SKILL.md` → error
  - Broken symlink (target does not exist) → error
  - Invalid JSON in `skill.json` → warning
  - Missing `name` field in `skill.json` → warning

  **Config Validation Checks:**

  - Registry name conflicts (overriding built-in `github`/`gitlab`)
  - Dangerous `installDir` paths (`src`, `node_modules`, `.git`, etc.)
  - Invalid `targetAgents` configuration
  - Dangerous skill names (`.git`, `..`, etc.)
  - Invalid skill reference formats
  - Version mismatch in monorepo skills

  ***

  新增 `doctor` 命令用于环境诊断

  **新命令：**

  - `reskill doctor` - 诊断 reskill 环境并检查问题
  - `reskill doctor --skip-network` - 跳过网络连通性检查（更快）
  - `reskill doctor --json` - 以 JSON 格式输出结果，便于脚本处理

  **检查项：**

  | 检查项             | 说明                                     |
  | ------------------ | ---------------------------------------- |
  | reskill version    | 当前版本及是否有更新可用                 |
  | Node.js version    | 需要 >=18.0.0                            |
  | Git                | Git 是否安装及版本号                     |
  | Git authentication | SSH key 或 credential helper 是否配置    |
  | Cache directory    | 缓存路径、大小和已缓存的 skill 数量      |
  | skills.json        | 配置文件是否存在及有效                   |
  | skills.lock        | 锁文件与 skills.json 的同步状态          |
  | Installed skills   | skill 完整性，提供详细诊断信息           |
  | Config validation  | Registry 冲突、危险路径、无效 agent 配置 |
  | Network            | GitHub 和 GitLab 连通性                  |

  **已安装 Skill 详细诊断：**

  - 同时缺少 `skill.json` 和 `SKILL.md` → 错误
  - 符号链接失效（目标不存在）→ 错误
  - `skill.json` 不是有效 JSON → 警告
  - `skill.json` 缺少 `name` 字段 → 警告

  **配置校验检查：**

  - Registry 名称冲突（覆盖内置的 `github`/`gitlab`）
  - 危险的 `installDir` 路径（`src`、`node_modules`、`.git` 等）
  - 无效的 `targetAgents` 配置
  - 危险的 skill 名称（`.git`、`..` 等）
  - 无效的 skill 引用格式
  - Monorepo 中的版本不一致

## 0.17.1

### Patch Changes

- 55a5ca4: Add unit tests for completion command

  添加 completion 命令的单元测试

- 6857776: Refactor integration tests from shell script to Vitest

  **Changes:**

  - Replace `scripts/integration-test.sh` with Vitest integration tests
  - Split tests into 6 files by functionality: basic, install-copy, install-symlink, install-global, uninstall, update
  - Add shared test helpers in `src/cli/commands/__integration__/helpers.ts`
  - Create separate vitest config `vitest.integration.config.ts` for integration tests
  - Update CI workflow to use `pnpm test:integration`

  ***

  重构集成测试，从 shell 脚本迁移到 Vitest

  **主要变更：**

  - 用 Vitest 集成测试替换 `scripts/integration-test.sh`
  - 按功能拆分为 6 个测试文件：basic、install-copy、install-symlink、install-global、uninstall、update
  - 在 `src/cli/commands/__integration__/helpers.ts` 中添加共享测试工具
  - 创建独立的 vitest 配置文件 `vitest.integration.config.ts`
  - 更新 CI 工作流使用 `pnpm test:integration`

## 0.17.0

### Minor Changes

- 0e0c6da: Remove link and unlink commands

  **Breaking Change:**

  - Removed `reskill link` command for linking local skills
  - Removed `reskill unlink` command for unlinking linked skills
  - Removed `link()` and `unlink()` methods from SkillManager API

  **Reason:**

  The link/unlink functionality was rarely used and added complexity to the codebase. Users can achieve similar results by manually creating symlinks or using the standard install command.

  ***

  移除 link 和 unlink 命令

  **破坏性变更：**

  - 移除了用于链接本地 skill 的 `reskill link` 命令
  - 移除了用于取消链接的 `reskill unlink` 命令
  - 移除了 SkillManager API 中的 `link()` 和 `unlink()` 方法

  **原因：**

  link/unlink 功能使用率较低，且增加了代码复杂度。用户可以通过手动创建符号链接或使用标准的 install 命令实现类似效果。

- 15e472a: Add smart installation defaults with persistent configuration

  **Changes:**

  - Store user's agent selection (`targetAgents`) and installation method (`installMode`) in `skills.json` defaults section
  - `reskill install` without arguments now uses stored config directly, skips all prompts, and reinstalls all skills from `skills.json`
  - `reskill install <skill>` uses stored config as default values in prompts, allowing user modification

  **Code Quality:**

  - Refactored `config-loader.ts` with better code organization, JSDoc comments, and private helper methods
  - Refactored `install.ts` by extracting types (`InstallOptions`, `InstallContext`), utility functions, and separating concerns into focused functions
  - Added comprehensive unit tests for the new defaults behavior

  ***

  新增智能安装默认配置持久化功能

  **主要变更：**

  - 将用户的 agent 选择（`targetAgents`）和安装方式（`installMode`）存储到 `skills.json` 的 defaults 配置中
  - `reskill install` 不带参数时直接使用存储的配置，跳过所有提示，重新安装 `skills.json` 中的所有 skills
  - `reskill install <skill>` 使用存储的配置作为提示的默认值，用户仍可修改

  **代码质量：**

  - 重构 `config-loader.ts`，改进代码组织结构，添加 JSDoc 注释和私有辅助方法
  - 重构 `install.ts`，提取类型定义（`InstallOptions`、`InstallContext`）和工具函数，将关注点分离到专注的函数中
  - 为新的默认配置行为添加了全面的单元测试

## 0.16.0

### Minor Changes

- f2b9d99: Add shell tab completion support for bash, zsh, and fish.

  New features:

  - `reskill completion install` - Install shell completion interactively
  - `reskill completion uninstall` - Remove shell completion
  - Subcommand completion: `reskill <Tab>` shows all available commands
  - Skill name completion for `info`, `uninstall`, `update` commands
  - Linked skill completion for `unlink` command
  - Option completion for `install -<Tab>` (shows -f, -g, -a, --force, etc.)
  - Agent name completion for `install -a <Tab>`

  ***

  新增 Shell Tab 补全功能，支持 bash、zsh 和 fish。

  新功能：

  - `reskill completion install` - 交互式安装 Shell 补全
  - `reskill completion uninstall` - 卸载 Shell 补全
  - 子命令补全：`reskill <Tab>` 显示所有可用命令
  - skill 名称补全：`info`、`uninstall`、`update` 命令支持补全已安装的 skill
  - 已链接 skill 补全：`unlink` 命令只补全已链接的 skill
  - 选项补全：`install -<Tab>` 显示 -f、-g、-a、--force 等选项
  - agent 名称补全：`install -a <Tab>` 补全 agent 名称

### Patch Changes

- 60530a6: Fix uninstall command to properly clean up all agent directories

  **Bug Fix:**

  - The `uninstall` command now correctly removes all agent-specific directories when uninstalling a skill
  - Ensures complete cleanup of skill files and prevents leftover directories

  ***

  修复 uninstall 命令，正确清理所有 agent 目录

  **问题修复：**

  - `uninstall` 命令现在会正确移除所有与 agent 相关的目录
  - 确保完全清理 skill 文件，防止遗留目录

- a516026: Check remote commit before reinstalling and unify file exclusion rules

  **Bug Fixes:**

  - Add `checkNeedsUpdate()` to compare local lock commit with remote commit
  - Add `getRemoteCommit()` to fetch remote commit via `git ls-remote`
  - Skip update when local and remote commits match, avoiding unnecessary reinstallation
  - Unify file exclusion rules between Installer and CacheManager:
    - Export `DEFAULT_EXCLUDE_FILES` (README.md, metadata.json, .reskill-commit)
    - Export `EXCLUDE_PREFIX` ('\_') for internal files
  - Update `copyDir()` to support `excludePrefix` option
  - Add comprehensive tests for update logic and file exclusion

  ***

  在重新安装前检查远程提交并统一文件排除规则

  **问题修复：**

  - 添加 `checkNeedsUpdate()` 方法比较本地锁定提交与远程提交
  - 添加 `getRemoteCommit()` 方法通过 `git ls-remote` 获取远程提交
  - 当本地和远程提交匹配时跳过更新,避免不必要的重新安装
  - 统一 Installer 和 CacheManager 之间的文件排除规则:
    - 导出 `DEFAULT_EXCLUDE_FILES` (README.md, metadata.json, .reskill-commit)
    - 导出 `EXCLUDE_PREFIX` ('\_') 用于内部文件
  - 更新 `copyDir()` 支持 `excludePrefix` 选项
  - 添加更新逻辑和文件排除的完整测试

## 0.15.0

### Minor Changes

- e5ae9c1: Add non-blocking CLI update notifier

  **New Feature:**

  - CLI now automatically checks for updates from npm registry on startup
  - Displays a friendly notification when a newer version is available
  - Non-blocking design with 3-second timeout, won't interrupt normal workflow
  - Errors are silently handled to ensure smooth user experience

  **New Module (`src/utils/update-notifier.ts`):**

  - `checkForUpdate()` - Check latest version from npm registry
  - `formatUpdateMessage()` - Format update notification message
  - `notifyUpdate()` - Non-blocking update notification

  **Documentation Updates:**

  - Updated README to recommend `npx reskill@latest` for consistent versioning
  - Added note explaining npx may use cached older versions without `@latest`
  - Updated all command examples in both English and Chinese documentation

  ***

  添加非阻塞式 CLI 更新通知

  **新功能：**

  - CLI 启动时自动从 npm registry 检查更新
  - 有新版本可用时显示友好的更新提示
  - 非阻塞设计，3 秒超时，不会影响正常工作流
  - 错误静默处理，确保用户体验流畅

  **新模块 (`src/utils/update-notifier.ts`):**

  - `checkForUpdate()` - 从 npm registry 检查最新版本
  - `formatUpdateMessage()` - 格式化更新提示消息
  - `notifyUpdate()` - 非阻塞式更新通知

  **文档更新：**

  - 更新 README，推荐使用 `npx reskill@latest` 以确保版本一致性
  - 添加说明：不加 `@latest` 时 npx 可能使用缓存的旧版本
  - 更新中英文文档中的所有命令示例

- c3087c6: Separate semantic version from Git reference in skills.lock (npm-style)

  Added a new `ref` field to `skills.lock` to store the Git reference (tag, branch, or commit), while the `version` field now stores the semantic version from `skill.json`. This follows npm's approach where version comes from package.json, not the Git ref.

  **ref field values by scenario:**
  | Input | ref | version |
  |-------|-----|---------|
  | `@v1.0.0` | `v1.0.0` | from skill.json or `v1.0.0` |
  | `@latest` | resolved tag (e.g. `v2.1.0`) | from skill.json or the tag |
  | `@master` | `master` | from skill.json or `master` |
  | `@branch:feature-x` | `feature-x` | from skill.json or `feature-x` |
  | `@commit:abc1234` | `abc1234` | from skill.json or `abc1234` |

  ***

  将语义化版本与 Git 引用在 skills.lock 中分离存储（npm 风格）

  在 `skills.lock` 中新增 `ref` 字段用于存储 Git 引用（tag、分支或 commit），而 `version` 字段现在存储来自 `skill.json` 的语义化版本。这与 npm 的处理方式一致，版本号来自 package.json 而非 Git 引用。

  **不同场景下 ref 字段的值：**
  | 输入 | ref | version |
  |------|-----|---------|
  | `@v1.0.0` | `v1.0.0` | 来自 skill.json 或 `v1.0.0` |
  | `@latest` | 解析后的 tag（如 `v2.1.0`） | 来自 skill.json 或该 tag |
  | `@master` | `master` | 来自 skill.json 或 `master` |
  | `@branch:feature-x` | `feature-x` | 来自 skill.json 或 `feature-x` |
  | `@commit:abc1234` | `abc1234` | 来自 skill.json 或 `abc1234` |

## 0.14.0

### Minor Changes

- dd64802: Support GitHub/GitLab web URLs with branch and subpath

  **New Feature:**

  - Now supports installing skills directly from GitHub/GitLab web URLs
  - Automatically extracts branch and subpath information from URLs like:
    - `https://github.com/user/repo/tree/main/skills/skill-name`
    - `https://github.com/user/repo/blob/dev/path/to/skill`
  - Branch is automatically set as the version (e.g., `branch:main`)

  **Technical Changes:**

  - Enhanced `parseGitUrl()` in `src/utils/git.ts` to detect and parse web URLs
  - Updated `parseGitUrlRef()` in `src/core/git-resolver.ts` to handle `/tree/`, `/blob/`, and `/raw/` patterns
  - Removed redundant web URL parsing code for cleaner implementation
  - Added comprehensive test cases for web URL parsing

  **Tested with:**

  - `https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices`
  - `https://github.com/anthropics/skills/tree/main/skills/pdf`
  - `https://github.com/OthmanAdi/planning-with-files/tree/master/skills/planning-with-files`

  ***

  支持 GitHub/GitLab 网页 URL（包含分支和子路径）

  **新功能：**

  - 现在支持直接从 GitHub/GitLab 网页 URL 安装 skills
  - 自动从 URL 中提取分支和子路径信息，例如：
    - `https://github.com/user/repo/tree/main/skills/skill-name`
    - `https://github.com/user/repo/blob/dev/path/to/skill`
  - 分支会自动设置为版本（例如 `branch:main`）

  **技术变更：**

  - 增强 `src/utils/git.ts` 中的 `parseGitUrl()` 以检测和解析网页 URL
  - 更新 `src/core/git-resolver.ts` 中的 `parseGitUrlRef()` 以处理 `/tree/`、`/blob/` 和 `/raw/` 模式
  - 删除冗余的网页 URL 解析代码，实现更简洁
  - 添加了全面的网页 URL 解析测试用例

  **测试验证：**

  - `https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices`
  - `https://github.com/anthropics/skills/tree/main/skills/pdf`
  - `https://github.com/OthmanAdi/planning-with-files/tree/master/skills/planning-with-files`

## 0.13.1

### Patch Changes

- fc7f0b9: Add CLAUDE.md documentation for Claude Code

  **Changes:**

  - Add CLAUDE.md with project overview, development commands, architecture, and code conventions
  - Provides guidance to Claude Code for working with this codebase

  ***

  添加 CLAUDE.md 文档支持 Claude Code

  **主要变更：**

  - 添加 CLAUDE.md，包含项目概述、开发命令、架构说明和代码规范
  - 为 Claude Code 在此代码库中工作提供指导

## 0.13.0

### Minor Changes

- 447b9c7: Auto-select project scope when skills.json exists, skipping the interactive scope prompt

  ***

  当项目中存在 skills.json 时，自动选择项目级安装，跳过交互式的安装范围选择提示

### Patch Changes

- 6f80adb: Fix CLI version display to read from package.json instead of hardcoded value

  **Bug Fix:**

  - The `--version` flag now dynamically reads the version from `package.json` instead of using a hardcoded `0.1.0` value
  - This ensures the CLI always displays the correct version number after releases

  **Technical Changes:**

  - Added dynamic import of `package.json` in `src/cli/index.ts`
  - Used Node.js built-in modules (`fs`, `path`, `url`) to resolve the package.json path at runtime
  - Replaced hardcoded `.version('0.1.0')` with `.version(packageJson.version)`

  ***

  修复 CLI 版本显示，从 package.json 读取而非硬编码

  **问题修复：**

  - `--version` 参数现在动态读取 `package.json` 中的版本号，而不是使用硬编码的 `0.1.0`
  - 确保 CLI 在发版后始终显示正确的版本号

  **技术变更：**

  - 在 `src/cli/index.ts` 中动态导入 `package.json`
  - 使用 Node.js 内置模块（`fs`、`path`、`url`）在运行时解析 package.json 路径
  - 将硬编码的 `.version('0.1.0')` 替换为 `.version(packageJson.version)`

## 0.12.1

### Patch Changes

- 14716d4: Fix three issues in the installation flow:

  1. **Fix `.reskill-commit` file leakage**: The internal metadata file `.reskill-commit` is no longer copied to the target skill directory during installation
  2. **Auto-create `skills.json` on first install**: When installing a skill in a project without `skills.json`, the config file is now automatically initialized
  3. **Smart error tips based on URL type**: Git clone failure messages now show authentication tips specific to the URL type (SSH or HTTPS) instead of showing all tips

  ***

  修复安装流程中的三个问题：

  1. **修复 `.reskill-commit` 文件泄漏**：安装 skill 时不再将内部元数据文件 `.reskill-commit` 复制到目标目录
  2. **首次安装时自动创建 `skills.json`**：在没有 `skills.json` 的项目中安装 skill 时，会自动初始化配置文件
  3. **智能化错误提示**：Git clone 失败时，根据 URL 类型（SSH/HTTPS）显示对应的认证提示

## 0.12.0

### Minor Changes

- e916723: Fix `list()` and `getInstalledSkill()` methods to correctly check canonical directory

  **Bug Fixes:**

  - `list()` and `getInstalledSkill()` now check `.agents/skills/` canonical directory, not just `.skills/` directory
  - Fixed issue where `list` and `info` commands showed "No skills installed" after installation

  **Changes:**

  - Added `getCanonicalSkillsDir()` method returning `.agents/skills/` canonical location
  - `getSkillPath()` now checks canonical location first, then falls back to legacy location
  - `list()` now scans both canonical and legacy directories with automatic deduplication
  - Added `getInstalledSkillFromPath()` helper method to avoid code duplication
  - `link()` command now uses `path.dirname(linkPath)` for directory creation

  **Backward Compatibility:**

  - Still supports skills in legacy `.skills/` location
  - Automatically detects and merges skill lists from both locations

  **CI/Docs:**

  - Fixed CI workflow: use `pnpm changeset version` instead of `pnpm version`
  - Added `fetch-depth: 0` to checkout step for complete git history
  - Added release workflow checklist and troubleshooting guide

  ***

  修复 `list()` 和 `getInstalledSkill()` 方法，现在会正确检查规范目录（canonical directory）

  **问题修复：**

  - `list()` 和 `getInstalledSkill()` 现在会检查 `.agents/skills/` 规范目录，而不仅仅是 `.skills/` 目录
  - 修复了安装技能后 `list` 和 `info` 命令显示 "No skills installed" 的问题

  **主要变更：**

  - 新增 `getCanonicalSkillsDir()` 方法，返回 `.agents/skills/` 规范位置
  - `getSkillPath()` 现在优先检查规范位置，然后回退到旧位置
  - `list()` 现在会扫描规范和旧目录，并自动去重
  - 新增 `getInstalledSkillFromPath()` 辅助方法，避免代码重复
  - `link()` 命令现在使用 `path.dirname(linkPath)` 创建目录

  **向后兼容：**

  - 仍然支持旧位置 `.skills/` 中的技能
  - 自动检测并合并两个位置的技能列表

  **CI/文档：**

  - 修复 CI 工作流：使用 `pnpm changeset version` 替代 `pnpm version`
  - 添加 `fetch-depth: 0` 以获取完整 git 历史
  - 添加发版流程检查清单和故障排除指南
