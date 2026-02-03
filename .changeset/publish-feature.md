---
"reskill": minor
---

Add `reskill publish` command for publishing skills to private registries

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

---

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
