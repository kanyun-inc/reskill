---
"reskill": minor
---

Add `doctor` command for environment diagnostics

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
