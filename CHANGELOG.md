# reskill

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
