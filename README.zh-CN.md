<div align="center">

# reskill

**基于 Git 的 AI Agent Skills 包管理器**

*类似 npm/Go modules 的声明式 skill 管理 — 安装、版本控制、同步和共享 AI agent skills*

[![npm version](https://img.shields.io/npm/v/reskill.svg)](https://www.npmjs.com/package/reskill)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](./README.md) | 简体中文

</div>

---

## 快速开始

```bash
# 1. 初始化项目
npx reskill@latest init

# 2. 安装 skill
npx reskill@latest install github:anthropics/skills/frontend-design@latest

# 3. 列出已安装的 skills
npx reskill@latest list
```

## 什么是 reskill？

reskill 是一个**基于 Git 的包管理器**，用于管理 AI agent skills，类似 npm 或 Go modules。它提供声明式配置、版本锁定和无缝同步，帮助你在项目和团队间管理 skills。

**支持：** Cursor、Claude Code、Codex、OpenCode、Windsurf、GitHub Copilot 等。

## 为什么选择 reskill？

reskill 提供**精细化的 skill 管理和同步方案**：

### 本地体验优化

- **声明式配置** — `skills.json` 清晰表达项目依赖
- **全局缓存** — 避免重复下载，加速安装

### 工程化项目管理

- **版本锁定** — `skills.lock` 确保团队一致性
- **灵活版本** — 支持精确版本、semver 范围、分支和 commit
- **Git 即 Registry** — 无需额外服务，任何 Git 仓库都可作为 skill 源

### 跨项目同步

- **版本控制** — 将 `skills.json` 和 `skills.lock` 提交到仓库
- **CI 集成** — 在 CI 中运行 `reskill install` 验证依赖
- **多 Registry** — 支持 GitHub、GitLab 和私有仓库

### 灵活的版本策略

```json
{
  "skills": {
    "frontend-design": "github:anthropics/skills/frontend-design@latest",
    "code-review": "github:team/code-review@v2.1.0",
    "testing": "github:team/testing@^1.0.0"
  }
}
```

运行 `reskill update` 时：

- `@latest` 的 skill 会自动更新到最新 tag
- `@v2.1.0` 保持不变
- `@^1.0.0` 会更新到 1.x.x 的最新版本

## 安装

```bash
# 全局安装（推荐常态化使用）
npm install -g reskill

# 或使用 npx（推荐加 @latest 确保最新版本）
npx reskill@latest <command>

# 单次使用也可以直接 npx reskill
npx reskill <command>
```

> **注意：** 使用 `npx` 时，建议使用 `npx reskill@latest` 以确保使用最新版本。不加 `@latest` 时，npx 可能会使用缓存的旧版本。

## 使用方式

### 源格式

```bash
# GitHub 简写
npx reskill@latest install github:user/skill@v1.0.0

# 完整 Git URL
npx reskill@latest install https://github.com/user/skill.git

# GitHub 网页 URL（支持分支和子路径）
npx reskill@latest install https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines

# GitLab
npx reskill@latest install gitlab:group/skill@latest

# 私有 Registry
npx reskill@latest install gitlab.company.com:team/skill@v1.0.0

# 默认 Registry（来自 skills.json）
npx reskill@latest install user/skill@v1.0.0
```

### 版本规范

| 格式     | 示例              | 说明                          |
| -------- | ----------------- | ----------------------------- |
| 精确版本 | `@v1.0.0`         | 锁定到指定 tag                |
| 最新版本 | `@latest`         | 获取最新 tag                  |
| 范围版本 | `@^2.0.0`         | semver 兼容（>=2.0.0 <3.0.0） |
| 分支     | `@branch:develop` | 指定分支                      |
| Commit   | `@commit:abc1234` | 指定 commit hash              |

## 命令

无需全局安装，直接使用 `npx reskill@latest`：

```bash
# 初始化项目
npx reskill@latest init

# 从 GitHub 安装 skill
npx reskill@latest install github:anthropics/skills/frontend-design@latest

# 从私有 GitLab 安装
npx reskill@latest install gitlab.company.com:team/internal-skill@v1.0.0

# 列出已安装的 skills
npx reskill@latest list
```

### 命令参考

| 命令                                    | 说明                                            |
| --------------------------------------- | ----------------------------------------------- |
| `npx reskill@latest init`               | 在当前目录初始化 `skills.json`                  |
| `npx reskill@latest install [skill]`    | 安装 `skills.json` 中的所有 skills 或指定 skill |
| `npx reskill@latest list`               | 列出已安装的 skills                             |
| `npx reskill@latest info <skill>`       | 查看 skill 详情                                 |
| `npx reskill@latest update [skill]`     | 更新所有或指定 skill                            |
| `npx reskill@latest outdated`           | 检查过期的 skills                               |
| `npx reskill@latest uninstall <skill>`  | 卸载 skill                                      |
| `npx reskill@latest completion install` | 安装 Shell Tab 补全                             |

运行 `npx reskill@latest <command> --help` 查看详细选项。

### Shell 补全

reskill 支持 bash、zsh 和 fish 的 Tab 补全。

```bash
# 安装补全（交互式，一次性设置）
reskill completion install

# 然后重启 shell 或执行：
source ~/.zshrc   # zsh
source ~/.bashrc  # bash
```

安装后即可使用 Tab 补全：

```bash
reskill <Tab>              # 显示所有命令
reskill info <Tab>         # 补全已安装的 skill 名称
reskill uninstall <Tab>    # 补全已安装的 skill 名称
reskill install -<Tab>     # 补全选项 (-f, -g, -a 等)
reskill install -a <Tab>   # 补全 agent 名称
```

卸载补全：`reskill completion uninstall`

## 私有 GitLab 支持

reskill 完整支持私有 GitLab 仓库，包括自建实例。认证通过系统的 git 配置透明处理。

### 认证方式

**SSH（推荐）**

reskill 自动使用你已有的 SSH 配置：

```bash
# 自动使用 ~/.ssh/id_rsa 或 ~/.ssh/id_ed25519
npx reskill@latest install gitlab.company.com:team/private-skill@v1.0.0

# 或使用显式的 SSH URL
npx reskill@latest install git@gitlab.company.com:team/private-skill.git@v1.0.0
```

确保你的 SSH key 已添加到 GitLab，并且 ssh-agent 正在运行。

**HTTPS + Git Credential**

适用于 CI/CD 或无 SSH 的环境，配置 git credential helper：

```bash
# 存储凭证（首次会提示输入，之后自动记住）
git config --global credential.helper store

# 或在 CI 中使用环境变量
git config --global credential.helper '!f() { echo "username=oauth2"; echo "password=${GITLAB_TOKEN}"; }; f'
```

GitLab CI/CD 可使用内置的 `CI_JOB_TOKEN`：

```yaml
before_script:
  - git config --global url."https://gitlab-ci-token:${CI_JOB_TOKEN}@gitlab.company.com/".insteadOf "https://gitlab.company.com/"
```

### Registry 配置

在 `skills.json` 中配置私有 registry：

```json
{
  "registries": {
    "internal": "https://gitlab.company.com",
    "private": "git@gitlab.internal.io"
  },
  "skills": {
    "company-standards": "internal:team/standards@latest",
    "private-utils": "private:utils/helpers@v1.0.0"
  }
}
```

### 自建 GitLab

对于使用自定义域名的自建 GitLab 实例：

```bash
# 直接安装
npx reskill@latest install git.mycompany.io:team/skill@v1.0.0

# 使用显式的 SSH URL
npx reskill@latest install git@git.mycompany.io:team/skill.git@v1.0.0
```

## 配置

### skills.json

```json
{
  "name": "my-project",
  "skills": {
    "planning": "github:user/planning-skill@v1.0.0",
    "code-review": "gitlab:team/code-review@latest"
  },
  "defaults": {
    "registry": "github",
    "installDir": ".skills"
  },
  "registries": {
    "internal": "https://gitlab.company.com"
  }
}
```

### skills.lock

锁定文件记录精确版本和 commit hash，确保团队间可复现的安装结果。

## 多 Agent 支持

reskill 支持所有主流 AI 编程 Agent。Skills 默认安装到 `.skills/` 目录，可与任何 Agent 集成。

| Agent          | 集成路径                              |
| -------------- | ------------------------------------- |
| Cursor         | `.cursor/rules/` 或 `.cursor/skills/` |
| Claude Code    | `.claude/skills/`                     |
| Codex          | `.codex/skills/`                      |
| OpenCode       | `.opencode/skills/`                   |
| Windsurf       | `.windsurf/skills/`                   |
| GitHub Copilot | `.github/skills/`                     |

## Skill 仓库结构

每个 Skill 仓库应遵循以下结构：

```
my-skill/
├── skill.json           # 元数据（必需）
├── SKILL.md             # 主入口文档（必需）
├── README.md            # 仓库说明
└── templates/           # 模板文件（可选）
```

### skill.json

```json
{
  "name": "my-skill",
  "version": "1.0.0",
  "description": "A skill for ...",
  "author": "Your Name",
  "license": "MIT",
  "entry": "SKILL.md",
  "keywords": ["ai", "skill"]
}
```

## 项目结构

安装后的目录结构：

```
my-project/
├── skills.json          # 依赖声明
├── skills.lock          # 版本锁定文件
└── .skills/             # 安装目录
    ├── planning/
    │   ├── skill.json
    │   └── SKILL.md
    └── code-review/
        ├── skill.json
        └── SKILL.md
```

## 环境变量

| 变量                | 说明         | 默认值             |
| ------------------- | ------------ | ------------------ |
| `RESKILL_CACHE_DIR` | 全局缓存目录 | `~/.reskill-cache` |
| `DEBUG`             | 启用调试日志 | -                  |

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 运行测试
pnpm test

# 类型检查
pnpm typecheck
```

## 致谢

reskill 的实现参考了以下优秀项目：

- [add-skill](https://github.com/vercel-labs/add-skill) by Vercel Labs
- [skild](https://github.com/Peiiii/skild) by Peiiii
- [openskills](https://github.com/numman-ali/openskills) by Numman Ali

感谢这些项目为 AI agent skills 生态系统做出的开创性贡献！

## 相关链接

- [Agent Skills 规范](https://agentskills.io)

## 许可证

MIT
