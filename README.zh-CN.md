<!-- source: README.md -->
<!-- synced: 2026-02-12 -->
<div align="center">

<img src="https://raw.githubusercontent.com/kanyun-ai-infra/reskill/main/logov2.png" alt="reskill" height="48" />

**基于 Git 的 AI Agent Skills 包管理器**

*类似 npm/Go modules 的声明式 skill 管理 — 安装、版本控制、同步和共享 AI agent skills*

[![npm version](https://img.shields.io/npm/v/reskill.svg)](https://www.npmjs.com/package/reskill)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](./README.md) | 简体中文

</div>

---

## 快速开始

```bash
npx reskill@latest init
npx reskill@latest install github:anthropics/skills/skills/frontend-design@latest
npx reskill@latest list
```

## 特性

- **一键安装** — 从任意 Git 仓库一键安装 skill
- **声明式配置** — `skills.json` + `skills.lock` 确保团队一致性
- **灵活版本** — 精确版本、semver 范围、分支、commit
- **多源支持** — GitHub、GitLab、自建仓库、HTTP/OSS 归档
- **多 Agent** — Cursor、Claude Code、Codex、Windsurf、GitHub Copilot 等
- **Registry 支持** — 发布和共享 skills

## 安装

**环境要求：** Node.js >= 18.0.0

```bash
npm install -g reskill        # 全局安装
npx reskill@latest <command>  # 或直接使用 npx
```

## 命令

| 命令                  | 别名                 | 说明                      |
| --------------------- | -------------------- | ------------------------- |
| `init`                | -                    | 初始化 `skills.json`      |
| `find <query>`        | -                    | 在 registry 中搜索 skills |
| `install [skills...]` | `i`                  | 安装一个或多个 skills     |
| `list`                | `ls`                 | 列出已安装的 skills       |
| `info <skill>`        | -                    | 查看 skill 详情           |
| `update [skill]`      | `up`                 | 更新 skills               |
| `outdated`            | -                    | 检查过期的 skills         |
| `uninstall <skill>`   | `un`, `rm`, `remove` | 卸载 skill                |
| `publish [path]`      | `pub`                | 发布 skill 到 registry ¹  |
| `login`               | -                    | 登录 registry ¹           |
| `logout`              | -                    | 登出 registry ¹           |
| `whoami`              | -                    | 显示当前登录用户 ¹        |
| `doctor`              | -                    | 诊断环境并检查问题        |
| `completion install`  | -                    | 安装 Shell Tab 补全       |

> ¹ Registry 相关命令（`publish`、`login`、`logout`、`whoami`）需要部署私有 registry 后才能使用，暂不对外开放。

### 常用选项

| 选项                      | 适用命令                             | 说明                                         |
| ------------------------- | ------------------------------------ | -------------------------------------------- |
| `--no-save`               | `install`                            | 安装时不保存到 `skills.json`（用于个人技能） |
| `-g, --global`            | `install`, `uninstall`, `list`       | 全局安装/管理技能（用户目录）                |
| `-a, --agent <agents...>` | `install`                            | 指定目标 Agent（如 `cursor`, `claude-code`） |
| `--mode <mode>`           | `install`                            | 安装模式：`symlink`（默认）或 `copy`         |
| `--all`                   | `install`                            | 安装到所有 Agent                             |
| `-y, --yes`               | `install`, `uninstall`, `publish`    | 跳过确认提示                                 |
| `-f, --force`             | `install`                            | 强制重新安装                                 |
| `-s, --skill <names...>`  | `install`                            | 从多 skill 仓库中选择指定 skill              |
| `--list`                  | `install`                            | 列出仓库中可用的 skills（不安装）            |
| `-r, --registry <url>`    | `install`                            | 覆盖 registry URL（用于 registry 安装）      |
| `-j, --json`              | `list`, `info`, `outdated`, `doctor` | JSON 格式输出                                |

运行 `reskill <command> --help` 查看完整选项和详细用法。

## 源格式

```bash
# GitHub 简写
npx reskill@latest install github:user/skill@v1.0.0

# GitLab 简写
npx reskill@latest install gitlab:group/skill@latest

# 完整 Git URL (HTTPS)
npx reskill@latest install https://github.com/user/skill.git

# 完整 Git URL (SSH)
npx reskill@latest install git@github.com:user/skill.git

# GitHub/GitLab 网页 URL（含分支和子路径）
npx reskill@latest install https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines

# 自定义 Registry（自建 GitLab 等）
npx reskill@latest install gitlab.company.com:team/skill@v1.0.0

# HTTP/OSS 归档
npx reskill@latest install https://example.com/skills/my-skill-v1.0.0.tar.gz
npx reskill@latest install oss://bucket/path/skill.tar.gz
npx reskill@latest install s3://bucket/path/skill.zip

# Registry 安装（需要部署 registry）
npx reskill@latest install @scope/skill-name@1.0.0
npx reskill@latest install skill-name

# 一次安装多个 skills
npx reskill@latest install github:user/skill1 github:user/skill2@v1.0.0
```

### Monorepo 支持

对于包含多个技能的仓库（monorepo），可以指定技能目录的路径：

```bash
# 简写格式带子路径
npx reskill@latest install github:org/monorepo/skills/planning@v1.0.0
npx reskill@latest install gitlab:company/skills/frontend/components@latest

# URL 格式带子路径
npx reskill@latest install https://github.com/org/monorepo.git/skills/planning@v1.0.0
npx reskill@latest install git@gitlab.company.com:team/skills.git/backend/apis@v2.0.0

# GitHub 网页 URL 自动提取子路径
npx reskill@latest install https://github.com/org/monorepo/tree/main/skills/planning
```

**要求**：指定的目录必须包含符合 [Agent Skills 规范](https://agentskills.io) 的有效 `SKILL.md` 文件。

### HTTP/OSS URL 支持

支持从 HTTP/HTTPS URL 直接安装归档文件：

| 格式       | 示例                                                       | 说明            |
| ---------- | ---------------------------------------------------------- | --------------- |
| HTTPS URL  | `https://example.com/skill.tar.gz`                         | 直接下载链接    |
| 阿里云 OSS | `https://bucket.oss-cn-hangzhou.aliyuncs.com/skill.tar.gz` | 阿里云 OSS URL  |
| AWS S3     | `https://bucket.s3.amazonaws.com/skill.tar.gz`             | AWS S3 URL      |
| OSS 协议   | `oss://bucket/path/skill.tar.gz`                           | 阿里云 OSS 简写 |
| S3 协议    | `s3://bucket/path/skill.tar.gz`                            | AWS S3 简写     |

**支持的归档格式**：`.tar.gz`、`.tgz`、`.zip`、`.tar`

## 版本规范

| 格式     | 示例              | 说明                         |
| -------- | ----------------- | ---------------------------- |
| 精确版本 | `@v1.0.0`         | 锁定到指定 tag               |
| 最新版本 | `@latest`         | 获取最新 tag                 |
| 范围版本 | `@^2.0.0`         | semver 兼容 (>=2.0.0 <3.0.0) |
| 分支     | `@branch:develop` | 指定分支                     |
| Commit   | `@commit:abc1234` | 指定 commit hash             |
| (无)     | -                 | 默认分支 (main)              |

## 配置

### skills.json

```json
{
  "skills": {
    "planning": "github:user/planning-skill@v1.0.0",
    "internal-tool": "internal:team/tool@latest"
  },
  "registries": {
    "internal": "https://gitlab.company.com"
  },
  "defaults": {
    "installDir": ".skills",
    "targetAgents": ["cursor", "claude-code"],
    "installMode": "symlink"
  }
}
```

### 私有仓库

reskill 使用你已有的 git 凭证（SSH key 或 credential helper）。CI/CD 配置：

```bash
# GitLab CI
git config --global url."https://gitlab-ci-token:${CI_JOB_TOKEN}@gitlab.company.com/".insteadOf "https://gitlab.company.com/"
```

## 多 Agent 支持

Skills 默认安装到 `.skills/`，可与任何 Agent 集成：

| Agent          | 路径                                  |
| -------------- | ------------------------------------- |
| Cursor         | `.cursor/rules/` 或 `.cursor/skills/` |
| Claude Code    | `.claude/skills/`                     |
| Codex          | `.codex/skills/`                      |
| Windsurf       | `.windsurf/skills/`                   |
| GitHub Copilot | `.github/skills/`                     |
| OpenCode       | `.opencode/skills/`                   |

## 发布 Skills

> **注意：** 发布功能需要部署私有 registry 后才能使用，暂不对外开放。

将你的 skills 发布到 registry 供他人使用：

```bash
# 登录 registry
reskill login

# 验证但不发布（预览模式）
reskill publish --dry-run

# 发布 skill
reskill publish
```

详细的发布指南请参考 [CLI 规范](./docs/cli-spec.md#publish)。

## 环境变量

| 变量                | 说明                            | 默认值                         |
| ------------------- | ------------------------------- | ------------------------------ |
| `RESKILL_CACHE_DIR` | 全局缓存目录                    | `~/.reskill-cache`             |
| `RESKILL_TOKEN`     | 认证令牌（优先于 ~/.reskillrc） | -                              |
| `RESKILL_REGISTRY`  | 默认 registry URL               | `https://registry.reskill.dev` |
| `DEBUG`             | 启用调试日志                    | -                              |
| `NO_COLOR`          | 禁用彩色输出                    | -                              |

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

# 运行集成测试
pnpm test:integration

# 类型检查
pnpm typecheck
```

## 致谢

reskill 的实现参考了以下优秀项目：

- [add-skill](https://github.com/vercel-labs/add-skill) by Vercel Labs
- [skild](https://github.com/Peiiii/skild) by Peiiii
- [openskills](https://github.com/numman-ali/openskills) by Numman Ali

## 相关链接

- [Agent Skills 规范](https://agentskills.io)

## 许可证

MIT
