# Skills 管理系统设计方案

## 概述

基于 Git 的 Skills 包管理系统，类似 npm/Go modules 的架构，实现 AI Skills 的版本化管理、共享和复用。

## 核心理念

```
┌─────────────────────────────────────────────────────────────────┐
│                        设计原则                                  │
├─────────────────────────────────────────────────────────────────┤
│  1. Git 即 Registry - 无需额外服务，git 仓库就是 skill 存储源     │
│  2. 声明式配置 - skills.json 清晰表达项目依赖                     │
│  3. 版本锁定 - 支持精确版本、范围版本、latest                     │
│  4. 零侵入 - 不修改原有项目结构，skills 独立管理                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 一、整体架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Skills 生态系统                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐           │
│   │   GitHub    │     │   GitLab    │     │   Gitee     │           │
│   │   Skills    │     │   Skills    │     │   Skills    │           │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘           │
│          │                   │                   │                   │
│          └───────────────────┼───────────────────┘                   │
│                              │                                       │
│                              ▼                                       │
│                    ┌─────────────────┐                              │
│                    │   Skills CLI    │                              │
│                    │  (skills 命令)   │                              │
│                    └────────┬────────┘                              │
│                             │                                        │
│              ┌──────────────┼──────────────┐                        │
│              ▼              ▼              ▼                        │
│      ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│      │   install   │ │   update    │ │   publish   │               │
│      └─────────────┘ └─────────────┘ └─────────────┘               │
│                             │                                        │
│                             ▼                                        │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │                      项目目录                                  │  │
│   │  ├── skills.json          # 依赖声明                          │  │
│   │  ├── skills.lock          # 版本锁定                          │  │
│   │  └── .skills/             # 安装目录                          │  │
│   │      ├── planning-with-files/                                 │  │
│   │      ├── code-review/                                         │  │
│   │      └── web-builder/                                         │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 二、skills.json 规范

### 2.1 完整 Schema

```json
{
  "$schema": "https://cortex.zhenguanyu.com/schemas/skills.json",
  "name": "cortex-agent",
  "version": "1.0.0",
  "description": "Cortex Agent Skills Configuration",
  
  "skills": {
    "planning-with-files": "github:OthmanAdi/planning-with-files@v1.0.0",
    "code-review": "gitlab:cortex/skills/code-review@latest",
    "web-builder": "gitlab:cortex/skills/web-builder@^2.0.0",
    "internal-deploy": "gitlab-ee.zhenguanyu.com:cortex/skills/deploy@v1.2.3"
  },
  
  "registries": {
    "github": "https://github.com",
    "gitlab": "https://gitlab.com",
    "internal": "https://gitlab-ee.zhenguanyu.com"
  },
  
  "defaults": {
    "registry": "gitlab",
    "installDir": ".skills"
  },
  
  "overrides": {
    "planning-with-files": {
      "enabled": true,
      "config": {
        "plansDir": ".cursor/plans"
      }
    }
  }
}
```

### 2.2 版本规范

| 格式 | 示例 | 说明 |
|-----|------|------|
| 精确版本 | `@v1.0.0` | 锁定到指定 tag |
| 最新版本 | `@latest` | 获取最新 tag |
| 范围版本 | `@^2.0.0` | semver 兼容（>=2.0.0 <3.0.0） |
| 分支 | `@branch:develop` | 指定分支 |
| Commit | `@commit:abc1234` | 指定 commit hash |
| 无版本 | 无 `@` | 默认使用 main/master 分支 |

### 2.3 仓库引用格式

```
完整格式: <registry>:<owner>/<repo>@<version>
简写格式: <owner>/<repo>@<version>  (使用默认 registry)

示例:
  github:user/skill@v1.0.0           → https://github.com/user/skill
  gitlab:group/skill@latest          → https://gitlab.com/group/skill
  gitlab-ee.zhenguanyu.com:ns/skill  → https://gitlab-ee.zhenguanyu.com/ns/skill
  user/skill@v1.0.0                  → 使用 defaults.registry
```

---

## 三、skills.lock 规范

用于锁定精确版本，确保团队一致性：

```json
{
  "lockfileVersion": 1,
  "skills": {
    "planning-with-files": {
      "source": "github:OthmanAdi/planning-with-files",
      "version": "v1.0.0",
      "resolved": "https://github.com/OthmanAdi/planning-with-files",
      "commit": "abc1234def5678901234567890abcdef12345678",
      "installedAt": "2025-01-21T10:30:00Z"
    },
    "code-review": {
      "source": "gitlab:cortex/skills/code-review",
      "version": "v2.1.0",
      "resolved": "https://gitlab.com/cortex/skills/code-review",
      "commit": "def5678abc1234567890abcdef1234567890abcd",
      "installedAt": "2025-01-21T10:30:00Z"
    }
  }
}
```

---

## 四、Skill 仓库结构规范

每个 Skill 仓库应遵循以下结构：

```
skill-name/
├── skill.json              # Skill 元数据（必需）
├── SKILL.md                # 主入口文档（必需）
├── README.md               # 仓库说明
├── reference.md            # 详细参考文档（可选）
├── examples.md             # 使用示例（可选）
├── templates/              # 模板文件（可选）
│   ├── template1.md
│   └── template2.md
└── assets/                 # 静态资源（可选）
    └── ...
```

### 4.1 skill.json 规范

```json
{
  "name": "planning-with-files",
  "version": "1.0.0",
  "description": "A skill for planning tasks using markdown files",
  "author": "OthmanAdi",
  "license": "MIT",
  
  "entry": "SKILL.md",
  
  "files": [
    "SKILL.md",
    "reference.md",
    "examples.md",
    "templates/"
  ],
  
  "keywords": ["planning", "task-management", "markdown"],
  
  "repository": {
    "type": "git",
    "url": "https://github.com/OthmanAdi/planning-with-files"
  },
  
  "config": {
    "plansDir": {
      "type": "string",
      "default": ".plans",
      "description": "Directory for plan files"
    }
  },
  
  "compatibility": {
    "claude": ">=3.5",
    "cursor": ">=0.40"
  }
}
```

---

## 五、CLI 命令设计

### 5.1 命令概览

```bash
# 初始化
skills init                    # 创建 skills.json

# 安装管理
skills install                 # 安装 skills.json 中的所有 skills
skills install <skill>         # 安装单个 skill
skills install <skill>@<ver>   # 安装指定版本
skills uninstall <skill>       # 卸载 skill

# 更新管理
skills update                  # 更新所有 skills
skills update <skill>          # 更新单个 skill
skills outdated                # 检查过期 skills

# 信息查询
skills list                    # 列出已安装 skills
skills info <skill>            # 查看 skill 详情
skills search <keyword>        # 搜索 skills（需要索引服务，可选）

# 发布（可选）
skills publish                 # 发布 skill（打 tag + push）
```

### 5.2 命令详细设计

#### `skills init`

```bash
$ skills init

? Skill configuration name: cortex-agent
? Default registry: gitlab-ee.zhenguanyu.com
? Install directory: .skills

Created skills.json
```

生成的 `skills.json`:

```json
{
  "name": "cortex-agent",
  "skills": {},
  "defaults": {
    "registry": "gitlab-ee.zhenguanyu.com",
    "installDir": ".skills"
  }
}
```

#### `skills install`

```bash
$ skills install github:OthmanAdi/planning-with-files@v1.0.0

📦 Installing planning-with-files@v1.0.0...
   Cloning from https://github.com/OthmanAdi/planning-with-files
   Checking out tag v1.0.0
   Commit: abc1234
✅ Installed planning-with-files@v1.0.0 to .skills/planning-with-files

Updated skills.json
Updated skills.lock
```

#### `skills update`

```bash
$ skills update

📦 Checking for updates...

  Skill                  Current   Latest    Status
  planning-with-files    v1.0.0    v1.2.0    ⬆️ Update available
  code-review            v2.1.0    v2.1.0    ✅ Up to date
  web-builder            v3.0.0    v3.1.0    ⬆️ Update available

? Update all skills? (Y/n) y

📦 Updating planning-with-files v1.0.0 → v1.2.0...
✅ Updated planning-with-files to v1.2.0

📦 Updating web-builder v3.0.0 → v3.1.0...
✅ Updated web-builder to v3.1.0

Updated skills.lock
```

#### `skills list`

```bash
$ skills list

Installed Skills (.skills/):

  Name                   Version   Source                                    
  planning-with-files    v1.0.0    github:OthmanAdi/planning-with-files      
  code-review            v2.1.0    gitlab:cortex/skills/code-review          
  web-builder            v3.0.0    gitlab:cortex/skills/web-builder          

Total: 3 skills
```

---

## 六、工作流程

### 6.1 安装流程

```
skills install <skill>@<version>
        │
        ▼
┌───────────────────────┐
│  解析 skill 引用       │
│  - registry           │
│  - owner/repo         │
│  - version            │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│  检查本地缓存          │
│  ~/.skills-cache/     │
└───────────┬───────────┘
            │
            ▼
     ┌──────┴──────┐
     │ 缓存存在？   │
     └──────┬──────┘
       Yes  │  No
       ▼    │  ▼
  使用缓存   │  ┌───────────────────────┐
            │  │  git clone --depth 1  │
            │  │  (shallow clone)      │
            │  └───────────┬───────────┘
            │              │
            └──────────────┤
                           ▼
              ┌───────────────────────┐
              │  git checkout <tag>   │
              │  或 git fetch --tags  │
              │  获取指定版本          │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  复制到 .skills/      │
              │  (排除 .git 目录)     │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  更新 skills.json     │
              │  更新 skills.lock     │
              └───────────────────────┘
```

### 6.2 版本解析流程

```
@latest
    │
    ▼
┌─────────────────────────────────────┐
│  git ls-remote --tags <repo>        │
│  获取所有 tags                       │
└───────────────────┬─────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│  过滤 semver 格式 tags              │
│  v1.0.0, v1.1.0, v2.0.0...         │
└───────────────────┬─────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│  排序，取最新版本                    │
│  返回 v2.0.0                        │
└─────────────────────────────────────┘
```

### 6.3 Skill 加载流程（运行时）

```
Agent 启动
    │
    ▼
┌─────────────────────────────────────┐
│  读取 skills.json                   │
└───────────────────┬─────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│  扫描 .skills/ 目录                  │
│  验证已安装 skills                   │
└───────────────────┬─────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│  读取每个 skill 的 SKILL.md         │
│  解析为 system prompt 片段          │
└───────────────────┬─────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│  合并到 Agent System Prompt         │
└─────────────────────────────────────┘
```

---

## 七、目录结构

### 7.1 项目目录

```
my-project/
├── skills.json              # Skill 依赖声明
├── skills.lock              # 版本锁定文件
├── .skills/                 # 安装目录（加入 .gitignore）
│   ├── planning-with-files/
│   │   ├── skill.json
│   │   ├── SKILL.md
│   │   ├── reference.md
│   │   └── templates/
│   ├── code-review/
│   │   ├── skill.json
│   │   └── SKILL.md
│   └── web-builder/
│       ├── skill.json
│       └── SKILL.md
└── ... (其他项目文件)
```

### 7.2 全局缓存目录

```
~/.skills-cache/
├── github/
│   └── OthmanAdi/
│       └── planning-with-files/
│           ├── v1.0.0/
│           ├── v1.1.0/
│           └── v1.2.0/
└── gitlab-ee.zhenguanyu.com/
    └── cortex/
        └── skills/
            └── code-review/
                ├── v2.0.0/
                └── v2.1.0/
```

---

## 八、与现有系统集成

### 8.1 Cursor 集成

Cursor 通过 `.cursor/rules/` 加载规则。Skills 可以：

1. **符号链接方式**：
```bash
# 安装后自动创建链接
ln -s .skills/planning-with-files/SKILL.md .cursor/rules/planning-with-files.md
```

2. **合并输出方式**：
```bash
# skills 命令生成合并文件
skills build --output .cursor/rules/skills-combined.md
```

### 8.2 Claude Code 集成

Claude Code 使用 `.claude/` 目录：

```bash
# 方式 1：符号链接
ln -s ../.skills .claude/skills

# 方式 2：复制
skills build --target claude --output .claude/skills/
```

### 8.3 Agent 运行时集成

```typescript
// apps/agent/lib/skills/skill-loader.ts

import { SkillManager } from './skill-manager';

export async function loadSkills(projectDir: string): Promise<Skill[]> {
  const manager = new SkillManager(projectDir);
  
  // 读取 skills.json
  const config = await manager.loadConfig();
  
  // 扫描 .skills/ 目录
  const installedSkills = await manager.scanInstalled();
  
  // 验证并加载
  const skills: Skill[] = [];
  for (const [name, spec] of Object.entries(config.skills)) {
    const skill = installedSkills.get(name);
    if (skill) {
      skills.push(await manager.loadSkill(skill));
    } else {
      console.warn(`Skill ${name} not installed, run: skills install`);
    }
  }
  
  return skills;
}
```

---

## 九、实现计划

### Phase 1：核心功能（MVP）

**目标**：实现基本的 install/list 功能

| 任务 | 优先级 | 预估 |
|-----|-------|------|
| 定义 skills.json schema | P0 | 1h |
| 定义 skill.json schema | P0 | 1h |
| 实现 `skills init` | P0 | 2h |
| 实现 `skills install` | P0 | 4h |
| 实现 `skills list` | P0 | 1h |
| 实现版本解析（tag 查询） | P0 | 2h |

### Phase 2：完整 CLI

**目标**：完整的包管理功能

| 任务 | 优先级 | 预估 |
|-----|-------|------|
| 实现 skills.lock | P1 | 2h |
| 实现 `skills update` | P1 | 2h |
| 实现 `skills uninstall` | P1 | 1h |
| 实现 `skills outdated` | P1 | 2h |
| 实现全局缓存 | P1 | 2h |

### Phase 3：运行时集成

**目标**：与 Agent 集成

| 任务 | 优先级 | 预估 |
|-----|-------|------|
| Skill Loader 实现 | P0 | 4h |
| System Prompt 合并 | P0 | 2h |
| Cursor 规则集成 | P1 | 2h |
| Claude Code 集成 | P1 | 2h |

### Phase 4：高级功能（可选）

| 任务 | 优先级 | 预估 |
|-----|-------|------|
| `skills search`（需索引服务） | P3 | 8h |
| `skills publish` | P3 | 4h |
| 依赖关系解析 | P3 | 8h |
| 私有仓库认证 | P2 | 4h |

---

## 十、FAQ

### Q: 为什么不用 npm/pnpm？

A: Skills 是文档/配置，不是代码包。使用专用工具可以：
- 简化安装流程（无 node_modules）
- 更好的版本语义（直接用 git tag）
- 更轻量（无依赖树）

### Q: 如何处理私有仓库？

A: 使用 git 凭证：
```bash
# 配置 git 凭证
git config --global credential.helper store

# 或使用 SSH
skills.json 中使用 SSH URL
"skill": "git@gitlab-ee.zhenguanyu.com:cortex/skills/private.git@v1.0.0"
```

### Q: Skills 之间有依赖怎么办？

A: Phase 4 可以支持，但建议 Skills 保持独立：
```json
// skill.json
{
  "dependencies": {
    "base-skill": "^1.0.0"
  }
}
```

### Q: 如何保证团队一致性？

A: 
1. `skills.lock` 锁定精确版本
2. CI 中运行 `skills install` 验证
3. 提交 `skills.lock` 到版本控制

---

## 十一、附录

### A. 完整 skills.json JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "version": { "type": "string" },
    "description": { "type": "string" },
    "skills": {
      "type": "object",
      "additionalProperties": { "type": "string" }
    },
    "registries": {
      "type": "object",
      "additionalProperties": { "type": "string" }
    },
    "defaults": {
      "type": "object",
      "properties": {
        "registry": { "type": "string" },
        "installDir": { "type": "string" }
      }
    },
    "overrides": {
      "type": "object"
    }
  },
  "required": ["skills"]
}
```

### B. 错误码定义

| 错误码 | 说明 |
|-------|------|
| E001 | skills.json 不存在 |
| E002 | skills.json 格式错误 |
| E003 | Skill 仓库不存在 |
| E004 | 版本/Tag 不存在 |
| E005 | Git 操作失败 |
| E006 | 权限不足 |
| E007 | 网络错误 |

### C. 环境变量

| 变量 | 说明 | 默认值 |
|-----|------|-------|
| `SKILLS_CACHE_DIR` | 全局缓存目录 | `~/.skills-cache` |
| `SKILLS_REGISTRY` | 默认 registry | `github` |
| `SKILLS_TOKEN` | Git 访问令牌 | - |
