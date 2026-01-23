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
npx reskill@latest init
npx reskill@latest install github:anthropics/skills/frontend-design@latest
npx reskill@latest list
```

## 特性

- **一键安装** — 从任意 Git 仓库一键安装 skill
- **声明式配置** — `skills.json` + `skills.lock` 确保团队一致性
- **灵活版本** — 精确版本、semver 范围、分支、commit
- **多 Registry** — GitHub、GitLab、自建、私有仓库
- **多 Agent** — Cursor、Claude Code、Codex、Windsurf、GitHub Copilot 等

## 安装

```bash
npm install -g reskill        # 全局安装
npx reskill@latest <command>  # 或直接使用 npx
```

## 命令

| 命令                 | 说明                 |
| -------------------- | -------------------- |
| `init`               | 初始化 `skills.json` |
| `install [skill]`    | 安装 skills          |
| `list`               | 列出已安装的 skills  |
| `info <skill>`       | 查看 skill 详情      |
| `update [skill]`     | 更新 skills          |
| `outdated`           | 检查过期的 skills    |
| `uninstall <skill>`  | 卸载 skill           |
| `doctor`             | 诊断环境并检查问题   |
| `completion install` | 安装 Shell Tab 补全  |

运行 `reskill <command> --help` 查看详细选项。

## 源格式

```bash
github:user/skill@v1.0.0                    # GitHub 简写
gitlab:group/skill@latest                   # GitLab 简写
gitlab.company.com:team/skill@v1.0.0        # 自建实例
https://github.com/user/repo/tree/main/path # 网页 URL（支持子路径）
```

## 版本规范

| 格式     | 示例              | 说明             |
| -------- | ----------------- | ---------------- |
| 精确版本 | `@v1.0.0`         | 锁定到指定 tag   |
| 最新版本 | `@latest`         | 获取最新 tag     |
| 范围版本 | `@^2.0.0`         | semver 兼容      |
| 分支     | `@branch:develop` | 指定分支         |
| Commit   | `@commit:abc1234` | 指定 commit hash |

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
    "installDir": ".skills"
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

## 相关链接

- [Agent Skills 规范](https://agentskills.io)

## 许可证

MIT
