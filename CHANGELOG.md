# reskill

## 1.5.0

### Minor Changes

- bd091c0: Support uninstalling multiple skills at once

  **Changes:**

  - `uninstall` command now accepts multiple skill names as arguments
  - Shows summary of all skills to be uninstalled before confirmation
  - Warns about skills that are not installed while still uninstalling the valid ones
  - Updated help text to show `<skills...>` instead of `<skill>`

  **Usage:**

  ```bash
  reskill uninstall skill-one skill-two skill-three -y
  ```

  ***

  支持一次性卸载多个 skills

  **变更：**

  - `uninstall` 命令现在接受多个 skill 名称作为参数
  - 在确认前显示所有要卸载的 skills 摘要
  - 对未安装的 skills 发出警告，同时继续卸载有效的 skills
  - 更新帮助文本，显示 `<skills...>` 而不是 `<skill>`

  **用法：**

  ```bash
  reskill uninstall skill-one skill-two skill-three -y
  ```

### Patch Changes

- 2af7991: Fix cache collision for different skills in the same monorepo

  **Bug:**
  When installing multiple skills from the same monorepo (e.g., `github:antfu/skills/skills/unocss` and `github:antfu/skills/skills/pnpm`), they would share the same cache path, causing the wrong skill to be installed.

  **Root Cause:**
  The `getSkillCachePath` method did not include the `subPath` in the cache path calculation, resulting in all skills from the same repo using identical cache paths.

  **Fix:**
  Include `subPath` in the cache path to ensure each skill has its own unique cache location:

  - Before: `~/.reskill-cache/github/antfu/skills/main/`
  - After: `~/.reskill-cache/github/antfu/skills/skills/unocss/main/`

  ***

  修复同一 monorepo 中不同 skills 的缓存冲突问题

  **Bug:**
  从同一个 monorepo 安装多个 skills 时（如 `github:antfu/skills/skills/unocss` 和 `github:antfu/skills/skills/pnpm`），它们会共用同一个缓存路径，导致安装错误的 skill。

  **根本原因:**
  `getSkillCachePath` 方法在计算缓存路径时没有包含 `subPath`，导致同一仓库的所有 skills 使用相同的缓存路径。

  **修复:**
  在缓存路径中包含 `subPath`，确保每个 skill 有独立的缓存位置：

  - 修复前: `~/.reskill-cache/github/antfu/skills/main/`
  - 修复后: `~/.reskill-cache/github/antfu/skills/skills/unocss/main/`

## 1.4.2

### Patch Changes

- ec62902: Improve publish command UX when version is missing in SKILL.md

  **Changes:**

  - Interactive mode now prompts user to enter version number when missing
  - Empty input cancels publish, allowing user to add version to SKILL.md first
  - Fixed confirm prompt default to Yes (Y/n) - press Enter to confirm
  - Fixed warning display: no longer shows "No version specified" after user provides version

  **Backward Compatibility:**

  - `--yes` and `--dry-run` modes continue using 0.0.0 as default (unchanged)

  ***

  改进 publish 命令在 SKILL.md 缺少 version 时的用户体验

  **变更：**

  - 交互模式下，缺少版本时会提示用户输入版本号
  - 留空取消发布，方便用户先在 SKILL.md 中补充 version
  - 修复确认提示默认值为 Yes (Y/n) - 按 Enter 直接确认
  - 修复警告显示：用户输入版本后不再显示"未指定版本"警告

  **向后兼容：**

  - `--yes` 和 `--dry-run` 模式仍使用 0.0.0 作为默认值（无变化）

## 1.4.1

### Patch Changes

- 9ec8fc5: Fix publish command not reading registry config from skills.json

  **Bug Fixes:**

  - Fixed `publish` command unable to read `defaults.publishRegistry` from `skills.json`. The command was incorrectly using the skill path instead of the project root directory to locate the config file.

  **Improvements:**

  - Changed publish confirmation prompt default from "No" to "Yes". Now pressing Enter will confirm the publish instead of canceling it.
  - Added explicit default indicator in prompt: `(Y/n) default: yes`

  ***

  修复 publish 命令无法从 skills.json 读取 registry 配置的问题

  **Bug 修复：**

  - 修复了 `publish` 命令无法读取 `skills.json` 中 `defaults.publishRegistry` 配置的问题。原因是命令错误地使用 skill 路径而非项目根目录来查找配置文件。

  **改进：**

  - 将发布确认提示的默认选项从 "No" 改为 "Yes"。现在按回车将确认发布而非取消。
  - 在提示中添加了明确的默认选项指示：`(Y/n) default: yes`

## 1.4.0

### Minor Changes

- ca5ae70: Use SKILL.md as the sole source of skill metadata

  **Changes:**

  - Skill name is now read from SKILL.md `name` field instead of folder name when installing from monorepo subpaths
  - All metadata (name, version, description, license, keywords) is now exclusively read from SKILL.md
  - `skill.json` is completely ignored during installation and publishing
  - Publish command now uses SKILL.md name as the authoritative source (excluding scope)
  - Doctor command only checks for SKILL.md existence, no longer validates skill.json

  **Bug Fixes:**

  - Fixed: Installing skills from monorepo subpaths (e.g., `github:user/repo/skill`) incorrectly used folder name instead of SKILL.md name

  **Migration:**

  - Ensure all skills have a valid SKILL.md with `name`, `description`, and optionally `version` in YAML frontmatter
  - `skill.json` files are no longer required and will be ignored

  ***

  使用 SKILL.md 作为技能元数据的唯一来源

  **变更：**

  - 从 monorepo 子路径安装技能时，技能名称现在从 SKILL.md 的 `name` 字段读取，而非文件夹名
  - 所有元数据（name、version、description、license、keywords）现在完全从 SKILL.md 读取
  - 安装和发布过程中完全忽略 `skill.json`
  - 发布命令现在使用 SKILL.md 的 name 作为权威来源（不包括 scope 部分）
  - doctor 命令只检查 SKILL.md 是否存在，不再验证 skill.json

  **Bug 修复：**

  - 修复：从 monorepo 子路径安装技能（如 `github:user/repo/skill`）时错误地使用文件夹名而非 SKILL.md 中的名称

  **迁移指南：**

  - 确保所有技能都有有效的 SKILL.md，并在 YAML frontmatter 中包含 `name`、`description`，以及可选的 `version`
  - `skill.json` 文件不再需要，将被忽略

## 1.3.1

### Patch Changes

- 7d5afc2: Update README documentation with latest features

  **Changes:**

  - Add new commands: `publish`, `login`, `logout`, `whoami`
  - Add command aliases (`i`, `ls`, `un`, `rm`, `up`, `pub`)
  - Add HTTP/OSS URL support for installing from archives
  - Add new environment variables: `RESKILL_TOKEN`, `RESKILL_REGISTRY`, `NO_COLOR`
  - Add Node.js version requirement (>= 18.0.0)
  - Update common options documentation
  - Improve source formats examples

  ***

  更新 README 文档，完善最新功能说明

  **变更：**

  - 添加新命令：`publish`、`login`、`logout`、`whoami`
  - 添加命令别名（`i`、`ls`、`un`、`rm`、`up`、`pub`）
  - 添加 HTTP/OSS URL 支持，可从归档文件安装
  - 添加新环境变量：`RESKILL_TOKEN`、`RESKILL_REGISTRY`、`NO_COLOR`
  - 添加 Node.js 版本要求（>= 18.0.0）
  - 更新常用选项文档
  - 完善源格式示例

## 1.3.0

### Minor Changes

- e8304d6: Add `reskill publish` command for publishing skills to private registries

  **New Features:**

  - **Publish Command (`reskill publish`)**: Full CLI support for publishing skills to private registries

    - `--registry <url>`: Specify target registry (or use `RESKILL_REGISTRY` env var, or `defaults.publishRegistry` in skills.json)
    - `--tag <tag>`: Publish with a specific Git tag
    - `--dry-run`: Validate skill without actually publishing
    - `--yes`: Skip confirmation prompts for CI/CD workflows
    - Alias: `reskill pub`

  - **Skill Validation**: Comprehensive validation following [agentskills.io specification](https://agentskills.io/specification)

    - SKILL.md is required (with `name` and `description` in YAML frontmatter)
    - skill.json is optional (for additional metadata like version, keywords)
    - Auto-synthesis of skill.json from SKILL.md when not present
    - Name, version (semver), and description validation with helpful error messages

  - **Git Integration**: Automatic extraction of Git metadata for publishing

    - Repository URL, branch, commit hash, and commit date
    - Git tag detection and validation
    - Working tree dirty check with warnings
    - Source reference format (e.g., `github:user/repo`)

  - **Registry Client**: Full API client for registry interactions

    - Tarball creation with gzip compression
    - FormData-based publish endpoint
    - Integrity hash generation (SHA256)
    - Error handling with specific status code messages (409 for version conflict, 403 for permission denied)

  - **Authentication**: Token management via `~/.reskillrc`
    - Support for `RESKILL_TOKEN` environment variable
    - Per-registry token storage
    - Integration with `reskill login` command

  **Security:**

  - CLI publishing to public registry (reskill.info) is blocked - users should use the web interface at https://reskill.info/submit
  - Only private registries are supported for CLI publishing

  ***

  新增 `reskill publish` 命令，支持将 skill 发布到私有 Registry

  **新功能：**

  - **发布命令 (`reskill publish`)**：完整的 CLI 支持，用于将 skill 发布到私有 Registry

    - `--registry <url>`：指定目标 Registry（或使用 `RESKILL_REGISTRY` 环境变量，或 skills.json 中的 `defaults.publishRegistry`）
    - `--tag <tag>`：使用指定的 Git tag 发布
    - `--dry-run`：仅验证 skill，不实际发布
    - `--yes`：跳过确认提示，适用于 CI/CD 流程
    - 别名：`reskill pub`

  - **Skill 验证**：遵循 [agentskills.io 规范](https://agentskills.io/specification) 的全面验证

    - SKILL.md 为必需文件（需在 YAML frontmatter 中包含 `name` 和 `description`）
    - skill.json 为可选文件（用于额外元数据如版本、关键词等）
    - 当 skill.json 不存在时，自动从 SKILL.md 合成
    - 名称、版本（semver）、描述验证，并提供友好的错误提示

  - **Git 集成**：自动提取 Git 元数据用于发布

    - 仓库 URL、分支、commit hash、commit 日期
    - Git tag 检测和验证
    - 工作区脏检查及警告提示
    - source reference 格式（如 `github:user/repo`）

  - **Registry 客户端**：完整的 Registry API 客户端

    - 使用 gzip 压缩创建 tarball
    - 基于 FormData 的发布接口
    - 完整性哈希生成（SHA256）
    - 错误处理，针对特定状态码提供明确信息（409 版本冲突、403 权限不足）

  - **认证**：通过 `~/.reskillrc` 管理 token
    - 支持 `RESKILL_TOKEN` 环境变量
    - 按 Registry 存储 token
    - 与 `reskill login` 命令集成

  **安全性：**

  - CLI 发布到公共 Registry（reskill.info）被禁止 - 用户应使用 https://reskill.info/submit 网页界面
  - CLI 仅支持发布到私有 Registry

## 1.2.0

### Minor Changes

- eca2582: Add HTTP/OSS URL support for skill installation

  **Changes:**

  - Added `HttpResolver` for parsing HTTP/HTTPS/OSS/S3 URLs
  - Added `downloadFile`, `extractArchive`, `downloadAndExtract` utilities
  - Updated `CacheManager` with `cacheFromHttp()` method
  - Updated `SkillManager` to auto-detect and handle HTTP sources
  - Support for archive formats: tar.gz, tgz, zip, tar

  **Supported URL formats:**

  - `https://example.com/skill-v1.0.0.tar.gz`
  - `https://bucket.oss-cn-hangzhou.aliyuncs.com/skill.tar.gz`
  - `oss://bucket/path/skill.tar.gz` (Aliyun OSS shorthand)
  - `s3://bucket/path/skill.tar.gz` (AWS S3 shorthand)

  ***

  新增 HTTP/OSS URL 安装支持

  **变更内容:**

  - 新增 `HttpResolver` 用于解析 HTTP/HTTPS/OSS/S3 URL
  - 新增 `downloadFile`、`extractArchive`、`downloadAndExtract` 工具函数
  - 更新 `CacheManager`，添加 `cacheFromHttp()` 方法
  - 更新 `SkillManager`，自动检测并处理 HTTP 源
  - 支持归档格式：tar.gz、tgz、zip、tar

  **支持的 URL 格式:**

  - `https://example.com/skill-v1.0.0.tar.gz`
  - `https://bucket.oss-cn-hangzhou.aliyuncs.com/skill.tar.gz`
  - `oss://bucket/path/skill.tar.gz`（阿里云 OSS 简写）
  - `s3://bucket/path/skill.tar.gz`（AWS S3 简写）

- a41f905: Auto-generate registries in skills.json

  **Changes:**

  - Add default `github` registry to `skills.json` on `reskill init`
  - Auto-add registry when installing skills with registry format (e.g., `github:user/repo`, `gitlab:user/repo`)
  - New `addRegistry()` method in ConfigLoader for programmatic registry management
  - Registries are not overwritten if already configured

  **Example:**

  After `reskill init`:

  ```json
  {
    "skills": {},
    "registries": {
      "github": "https://github.com"
    },
    "defaults": {
      "installDir": ".skills"
    }
  }
  ```

  After installing a GitLab skill:

  ```json
  {
    "skills": {
      "my-skill": "gitlab:user/repo@v1.0.0"
    },
    "registries": {
      "github": "https://github.com",
      "gitlab": "https://gitlab.com"
    },
    "defaults": {
      "installDir": ".skills"
    }
  }
  ```

  ***

  skills.json 自动生成 registries 配置

  **变更：**

  - `reskill init` 时默认添加 `github` registry
  - 安装 registry 格式的 skill 时自动添加对应的 registry（如 `github:user/repo`、`gitlab:user/repo`）
  - ConfigLoader 新增 `addRegistry()` 方法用于程序化管理 registry
  - 已存在的 registry 不会被覆盖

  **示例：**

  `reskill init` 后：

  ```json
  {
    "skills": {},
    "registries": {
      "github": "https://github.com"
    },
    "defaults": {
      "installDir": ".skills"
    }
  }
  ```

  安装 GitLab skill 后：

  ```json
  {
    "skills": {
      "my-skill": "gitlab:user/repo@v1.0.0"
    },
    "registries": {
      "github": "https://github.com",
      "gitlab": "https://gitlab.com"
    },
    "defaults": {
      "installDir": ".skills"
    }
  }
  ```

### Patch Changes

- 3461323: Fix Git SSH URL parsing and add WellKnownRegistry type

  **Bug Fixes:**

  - Fix `normalizeGitSshUrl` regex capture group issue where `.git` suffix might not be correctly handled
  - Simplify regex pattern and explicitly remove `.git` suffix for more reliable parsing

  **Improvements:**

  - Add `WellKnownRegistry` type export for consumers who need to type registry names
  - Add JSDoc documentation for `addRegistry()` method explaining the silent return behavior

  **Tests:**

  - Add test cases for SSH URL parsing edge cases (with/without `.git`, with/without version)

  ***

  修复 Git SSH URL 解析并添加 WellKnownRegistry 类型

  **Bug 修复：**

  - 修复 `normalizeGitSshUrl` 正则表达式捕获组问题，`.git` 后缀可能无法正确处理
  - 简化正则表达式模式并显式移除 `.git` 后缀，使解析更可靠

  **改进：**

  - 添加 `WellKnownRegistry` 类型导出，供需要类型化 registry 名称的消费者使用
  - 为 `addRegistry()` 方法添加 JSDoc 文档，说明静默返回的行为

  **测试：**

  - 添加 SSH URL 解析边缘情况的测试用例（有/无 `.git`、有/无版本号）

## 1.1.1

### Patch Changes

- c754b54: Fix CLI hanging when connecting to new SSH hosts

  **Bug Fixes:**

  - Fixed an issue where `reskill install` would hang indefinitely when cloning from a new SSH host (e.g., first time connecting to github.com)
  - Git commands now use `StrictHostKeyChecking=accept-new` to automatically accept new host keys while still rejecting changed keys (for security)
  - Added `BatchMode=yes` to fail fast instead of waiting for interactive input
  - Added `GIT_TERMINAL_PROMPT=0` to prevent HTTPS password prompts from hanging

  ***

  修复连接新 SSH 主机时 CLI 挂起的问题

  **Bug 修复：**

  - 修复了 `reskill install` 在首次通过 SSH 连接新主机（如首次连接 github.com）时会无限挂起的问题
  - Git 命令现在使用 `StrictHostKeyChecking=accept-new` 自动接受新主机的密钥，同时仍会拒绝已更改的密钥（保证安全性）
  - 添加 `BatchMode=yes` 使命令在需要交互输入时快速失败而非挂起
  - 添加 `GIT_TERMINAL_PROMPT=0` 防止 HTTPS 密码提示导致挂起

## 1.1.0

### Minor Changes

- 0dacf4d: Support installing multiple skills in a single command

  **Changes:**

  - `reskill install` now accepts multiple skill references as arguments
  - Batch installation shows a summary of all skills being installed
  - Reports both successful and failed installations in batch mode
  - Exits with code 1 if any skill in the batch fails

  **Usage:**

  ```bash
  # Install multiple skills at once
  reskill install github:user/skill1 github:user/skill2@v1.0.0 gitlab:team/skill3

  # Still supports single skill
  reskill install github:user/skill

  # Still supports reinstall all (no args)
  reskill install
  ```

  ***

  支持在单个命令中安装多个 skills

  **变更内容:**

  - `reskill install` 现在支持多个 skill 引用作为参数
  - 批量安装会显示所有要安装的 skills 摘要
  - 在批量模式下会报告成功和失败的安装结果
  - 如果批量中有任何 skill 失败，则以退出码 1 退出

  **使用方式:**

  ```bash
  # 一次安装多个 skills
  reskill install github:user/skill1 github:user/skill2@v1.0.0 gitlab:team/skill3

  # 仍然支持单个 skill
  reskill install github:user/skill

  # 仍然支持重新安装全部（无参数）
  reskill install
  ```

## 1.0.4

### Patch Changes

- 66baa62: Fix repository URL in package.json for npm provenance verification

  **Bug Fixes:**

  - Updated `repository.url` to match the actual GitHub repository (`kanyun-inc/reskill`)
  - Fixed `homepage` and `bugs.url` to point to the correct repository
  - This resolves npm publish failures caused by sigstore provenance verification mismatch

  ***

  修复 package.json 中的仓库 URL 以通过 npm 来源验证

  **Bug Fixes:**

  - 更新 `repository.url` 以匹配实际的 GitHub 仓库 (`kanyun-inc/reskill`)
  - 修复 `homepage` 和 `bugs.url` 指向正确的仓库地址
  - 解决了因 sigstore 来源验证不匹配导致的 npm 发布失败问题

## 1.0.3

### Patch Changes

- c0b5d5e: Fix install command to respect installDir configuration from skills.json

  **Bug Fixes:**

  - Fixed an issue where `reskill install` ignored the `installDir` setting in `skills.json`
  - Skills are now correctly installed to the configured directory instead of always using `.agents/skills/`

  ***

  修复 install 命令以正确使用 skills.json 中的 installDir 配置

  **Bug 修复：**

  - 修复了 `reskill install` 忽略 `skills.json` 中 `installDir` 设置的问题
  - 技能现在会正确安装到配置的目录，而不是总是使用 `.agents/skills/`

## 1.0.2

### Patch Changes

- 9ca197e: Fix scope selection behavior during skill installation

  **Changes:**

  - Only skip scope selection prompt when running `reskill install` without arguments (reinstall all)
  - Show scope selection prompt when installing a single skill with `reskill install <package>`
  - Previously, scope selection was skipped whenever `skills.json` existed, which was incorrect

  **Tests:**

  - Added unit tests for scope selection logic

  ***

  修复技能安装时的 scope 选择行为

  **变更：**

  - 仅在执行 `reskill install` 不带参数（重新安装全部）时跳过 scope 选择
  - 安装单个技能 `reskill install <package>` 时显示 scope 选择提示
  - 之前的行为是只要存在 `skills.json` 就跳过 scope 选择，这是不正确的

  **测试：**

  - 添加了 scope 选择逻辑的单元测试

## 1.0.1

### Patch Changes

- b2ea45a: Add doctor command specification and integration tests

  **Changes:**

  - Add `doctor` command specification to `docs/cli-spec.md` with full documentation including:
    - Command synopsis and options (`--json`, `--skip-network`)
    - All checks performed (environment, directory, configuration, network)
    - Expected behavior and exit codes
    - Output examples for success, warnings, and errors
    - JSON output format schema
  - Add 26 integration tests for `doctor` command covering:
    - CLI options (`--help`, `--json`, `--skip-network`)
    - Environment checks (Node.js, Git, authentication, cache)
    - Configuration checks (skills.json, skills.lock sync status)
    - Installed skills validation
    - Configuration validation (registry conflicts, dangerous paths, invalid agents/refs)
    - Exit codes and JSON output format

  **Bug Fixes:**

  - Fix JSON output parsing in integration tests to handle update notifier being appended after JSON output

  ***

  添加 doctor 命令规范文档和集成测试

  **主要变更：**

  - 在 `docs/cli-spec.md` 中添加 `doctor` 命令完整规范，包括：
    - 命令语法和选项（`--json`、`--skip-network`）
    - 所有检查项（环境、目录、配置、网络）
    - 预期行为和退出码
    - 成功、警告和错误的输出示例
    - JSON 输出格式说明
  - 添加 26 个 `doctor` 命令集成测试，覆盖：
    - CLI 选项（`--help`、`--json`、`--skip-network`）
    - 环境检查（Node.js、Git、认证、缓存）
    - 配置检查（skills.json、skills.lock 同步状态）
    - 已安装 skills 验证
    - 配置验证（注册表冲突、危险路径、无效 agent/引用）
    - 退出码和 JSON 输出格式

  **问题修复：**

  - 修复集成测试中 JSON 输出解析问题，处理 update notifier 追加在 JSON 后面的情况

## 1.0.0

### Major Changes

- 3b572cd: Release v1.0.0 - First stable release

  **Highlights:**

  - One-click install — Install any skill from any Git repo with a single command
  - Git-based skills package manager for AI agents
  - Declarative configuration with `skills.json` and `skills.lock`
  - Multi-agent support: Cursor, Claude Code, Codex, Windsurf, GitHub Copilot
  - Flexible versioning: exact versions, semver ranges, branches, commits
  - Multi-registry support: GitHub, GitLab, self-hosted, private repos

  ***

  发布 v1.0.0 - 首个正式版

  **亮点：**

  - 一键安装 - 从任意 Git 仓库一键安装 skill
  - 基于 Git 的 AI Agent Skills 包管理器
  - 声明式配置：`skills.json` + `skills.lock`
  - 多 Agent 支持：Cursor、Claude Code、Codex、Windsurf、GitHub Copilot
  - 灵活版本控制：精确版本、semver 范围、分支、commit
  - 多 Registry 支持：GitHub、GitLab、自建、私有仓库

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
