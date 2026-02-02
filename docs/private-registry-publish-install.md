# Reskill 私域 Skill 发布与安装方案

> 版本：v6  
> 日期：2026-02-02  
> 更新：适配页面发布功能（source_type 分支）

---

## 目录

- [核心设计](#核心设计)
- [Scope 配置](#scope-配置)
- [Publish 命令](#publish-命令)
- [Install 命令](#install-命令)
- [Tarball 结构](#tarball-结构)
- [安装后目录结构](#安装后目录结构)
- [同名冲突处理](#同名冲突处理)
- [数据库与存储](#数据库与存储)
- [改动清单](#改动清单)
- [完整数据流](#完整数据流)

---

## 核心设计

| 项目         | 设计                                                              |
| ------------ | ----------------------------------------------------------------- |
| 发布范围     | **仅支持私域**，不支持公域发布                                    |
| Scope 配置   | 代码内置默认值                                                    |
| 数据库索引   | 完整名称 `@kanyun/planning-with-files`                            |
| Tarball 结构 | 短名称 `planning-with-files/`（不带 scope）                       |
| 安装目录     | 短名称 `planning-with-files/`（不带 scope）                       |
| 同名冲突     | 报错提示                                                          |
| 来源追溯     | 通过 `source_type` 字段区分 CLI / 页面发布                        |
| 发布来源     | CLI（有版本管理）或 页面（无版本管理，详见 `web-publish-design.md`）|

### 为什么 Tarball 和安装目录不带 Scope？

AI 编码助手（如 Claude Code）期望的目录结构是：

```
.claude/skills/
└── <skill-name>/
    └── SKILL.md      ✅ 直接在 skill 目录下
```

如果带 `@kanyun/` 前缀：

```
.claude/skills/
└── @kanyun/
    └── <skill-name>/
        └── SKILL.md  ❌ 多了一层，AI 工具可能无法识别
```

### Scope 保留在哪里？

| 位置             |                是否带 Scope                 | 用途                         |
| ---------------- | :-----------------------------------------: | ---------------------------- |
| **数据库索引**   |       ✅ `@kanyun/planning-with-files`       | API 查询、权限控制、版本管理 |
| **API 请求**     | ✅ `/api/skills/@kanyun/planning-with-files` | 路由标识                     |
| **Tarball 内部** |          ❌ `planning-with-files/`           | 解压后目录结构               |
| **安装目录**     |          ❌ `planning-with-files/`           | AI 工具识别                  |

**查找文件靠的是数据库索引（完整名称 → artifact_key），不是靠 tarball 内部的目录名。**

---

## Scope 配置

### 代码内置配置

```typescript
// src/config/registries.ts

/**
 * 私域 Registry 配置
 */
export const PRIVATE_REGISTRIES: Record<string, string> = {
  'https://reskill-test.zhenguanyu.com/': '@kanyun',
};

/**
 * Registry → Scope
 */
export function getRegistryScope(registry: string): string | null {
  const normalizedUrl = registry.replace(/\/$/, '') + '/';
  return PRIVATE_REGISTRIES[normalizedUrl] || null;
}

/**
 * Scope → Registry
 */
export function getScopeRegistry(scope: string): string | null {
  for (const [registry, s] of Object.entries(PRIVATE_REGISTRIES)) {
    if (s === scope) return registry;
  }
  return null;
}
```

---

## Publish 命令

### 语法

```bash
reskill publish [path] [options]
```

### 参数与选项

| 参数/选项    | 必填  | 默认值              | 说明                 |
| ------------ | :---: | ------------------- | -------------------- |
| `[path]`     |   ❌   | `.`（当前目录）     | Skill 目录路径       |
| `--registry` |   ❌   | `$RESKILL_REGISTRY` | 私域 Registry URL    |
| `--tag`      |   ❌   | `latest`            | 发布标签             |
| `--dry-run`  |   ❌   | `false`             | 预览模式，不实际发布 |

### 使用示例

```bash
# 在 skill 目录内发布（推荐）
cd planning-with-files
reskill publish

# 发布指定目录
reskill publish ./planning-with-files

# 发布到指定 registry
reskill publish --registry=https://reskill-test.zhenguanyu.com/

# 预览发布内容
reskill publish --dry-run
```

### 完整流程

```
输入：
    path: ./planning-with-files（或当前目录）
    registry: https://reskill-test.zhenguanyu.com/
    │
    ▼
1. 确定 Skill 目录：
    ├── 有 path 参数 → 使用指定路径
    └── 无 path 参数 → 使用当前目录 (process.cwd())
    │
    ▼
2. 验证 Skill 目录：
    ├── 检查 SKILL.md 存在
    └── 不存在 → 报错 ❌
        "SKILL.md not found in /path/to/dir"
    │
    ▼
3. 确定 Registry：
    ├── --registry 参数
    ├── 或 $RESKILL_REGISTRY 环境变量
    └── 都没有 → 报错 ❌
        "No registry specified. Set RESKILL_REGISTRY or use --registry"
    │
    ▼
4. 验证私域 Registry：
    ├── 查询 PRIVATE_REGISTRIES[registry]
    ├── 找到 → scope = @kanyun
    └── 未找到 → 报错 ❌
        "Only private registry publishing is supported.
         Supported: https://reskill-test.zhenguanyu.com/"
    │
    ▼
5. 解析 Skill 信息：
    ├── 从 SKILL.md frontmatter 读取 name（可选）
    ├── 若无 name → 使用目录名
    │   目录路径 /path/to/planning-with-files → planning-with-files
    ├── 完整名称（存入数据库）: @kanyun/planning-with-files
    └── 短名称（Tarball 顶层目录）: planning-with-files
    │
    ▼
6. 创建 Tarball：
    planning-with-files/          ← 短名称（不带 @kanyun/）
    ├── SKILL.md
    └── ...
    │
    ▼
7. 上传到 Registry：
    POST /api/skills/publish
    - name: @kanyun/planning-with-files  ← 完整名称
    - tarball: <file>
    │
    ▼
输出：
    ✓ Published @kanyun/planning-with-files@2.4.5
    
    Name:      @kanyun/planning-with-files
    Version:   2.4.5
    Tag:       latest
    Integrity: sha256-b4aiu47PSnGA3gqonVgSWrSbFBmWp8su2xEfdGXEp0c=
```

---

## Install 命令

### 语法

```bash
reskill install <skill> [options]
```

### 参数与选项

| 参数/选项    | 必填  | 默认值        | 说明                    |
| ------------ | :---: | ------------- | ----------------------- |
| `<skill>`    |   ✅   | —             | `@scope/name[@version]` |
| `--registry` |   ❌   | 从 scope 反查 | Registry URL            |

### 版本指定方式

| 格式     | 示例                                | 说明             |
| -------- | ----------------------------------- | ---------------- |
| 仅名称   | `@kanyun/planning-with-files`       | 安装 `latest`    |
| 指定版本 | `@kanyun/planning-with-files@2.4.5` | 安装精确版本     |
| 指定标签 | `@kanyun/planning-with-files@beta`  | 安装标签对应版本 |

### 使用示例

```bash
# 安装 latest 版本
reskill install @kanyun/planning-with-files

# 安装指定版本
reskill install @kanyun/planning-with-files@2.4.5

# 安装 beta 标签
reskill install @kanyun/planning-with-files@beta
```

### 完整流程

```
输入：@kanyun/planning-with-files@2.4.5
    │
    ▼
1. 解析 Skill 标识：
    ├── 正则匹配: ^(@[a-z0-9_-]+)/([a-z0-9_-]+)(?:@(.+))?$
    ├── scope: @kanyun
    ├── name: planning-with-files
    └── version: 2.4.5（或 tag，或默认 latest）
    │
    ▼
2. 确定 Registry：
    ├── --registry 参数
    ├── 或从 scope 反查 PRIVATE_REGISTRIES
    │   @kanyun → https://reskill-test.zhenguanyu.com/
    └── 未找到 → 报错 ❌
        "Unknown scope @kanyun. Use --registry to specify."
    │
    ▼
3. 查询 Skill 信息（新增 source_type）：
    GET /api/skills/@kanyun/planning-with-files
    └── 获取 source_type, versions, dist-tags, artifact_key
    │
    ▼
4. 检查 source_type 并分支（v6 新增）：
    │
    ├── source_type = 'registry'（CLI 发布）
    │   └── 继续步骤 5（现有流程）
    │
    └── source_type ≠ 'registry'（页面发布）
        │
        ├── 有 @version 指定 → 报错 ❌
        │   "Version specifier not supported for web-published skills.
        │    Use: reskill install @kanyun/planning-with-files"
        │
        └── 根据 source_type 分支安装：
            ├── github/gitlab → Git clone source_url（解析 URL 获取 ref/path）
            ├── oss_url/custom_url → 直接下载 source_url
            └── local → 下载 OSS: source_url
            │
            └── 跳转到步骤 8（检查冲突）
    │
    ▼
5. 解析版本（仅 registry 模式）：
    ├── 是 semver 格式（如 2.4.5）→ 直接使用
    └── 否则视为 tag（如 latest/beta）→ 查询对应版本
    │
    ▼
6. 下载 Tarball（仅 registry 模式）：
    GET /api/skills/@kanyun/planning-with-files/versions/2.4.5/download
    └── 返回 tarball + integrity
    │
    ▼
7. 验证完整性（仅 registry 模式）：
    SHA256(tarball) === integrity
    │
    ▼
8. 确定安装目录：
    ├── 检测 .claude/ 存在 → .claude/skills/
    ├── 检测 .cursor/ 存在 → .cursor/skills/
    └── 默认 → .ai-skills/
    │
    ▼
9. 检查冲突：
    ├── 目录 .claude/skills/planning-with-files/ 已存在
    └── 报错 ❌（见「同名冲突处理」）
    │
    ▼
10. 解压/克隆到本地：
    .claude/skills/
    └── planning-with-files/    ← 短名称
        ├── SKILL.md
        └── ...
    │
    ▼
输出：
    ✓ Installed @kanyun/planning-with-files@2.4.5
    
    Location: .claude/skills/planning-with-files/
```

### Install 查找文件流程图（v6 更新）

```
用户输入: reskill install @kanyun/planning-with-files
                │
                ▼
        ┌───────────────────┐
        │   1. 查询 skills   │  ← 用完整名称 @kanyun/planning-with-files
        │   获取 source_type │
        └─────────┬─────────┘
                  │
                  ▼
        ┌───────────────────┐
        │  2. 判断 source_type
        └─────────┬─────────┘
                  │
        ┌─────────┴─────────────────────────────────┐
        │                                           │
        ▼                                           ▼
  source_type = 'registry'              source_type ≠ 'registry'（页面发布）
        │                                           │
        ▼                                           ▼
┌───────────────────┐                   ┌───────────────────────────┐
│  skill_versions   │                   │  根据 source_type 分支     │
│                   │                   │                           │
│  artifact_key:    │                   │  github/gitlab:           │
│  sha256/b4aiu...  │                   │    → Git clone source_url │
└─────────┬─────────┘                   │                           │
          │                             │  oss_url/custom_url:      │
          ▼                             │    → 下载 source_url      │
┌───────────────────┐                   │                           │
│  3. 下载 OSS      │                   │  local:                   │
│  sha256/<hash>.tgz│                   │    → 下载 OSS source_url  │
└─────────┬─────────┘                   └─────────────┬─────────────┘
          │                                           │
          └─────────────────┬─────────────────────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │   4. 解压到本地    │
                  │   .claude/skills/planning-with-files/
                  └───────────────────┘
```

**关键点**：
- CLI 发布（registry）：通过 `skill_versions.artifact_key` 查找 OSS 文件
- 页面发布（其他）：通过 `skills.source_url` 直接获取来源地址

---

## Tarball 结构

### 内部目录结构

```
skill.tgz
└── planning-with-files/      # 短名称（不带 @kanyun/）
    ├── SKILL.md
    ├── examples.md
    ├── reference.md
    ├── scripts/
    │   ├── init-session.sh
    │   └── check-complete.sh
    └── templates/
        ├── progress.md
        └── findings.md
```

### 创建逻辑

```typescript
async createTarball(skillPath: string, files: string[], shortName: string): Promise<Buffer> {
  // shortName = 'planning-with-files'（不带 @kanyun/）
  
  for (const file of files) {
    tarPack.entry({
      name: `${shortName}/${file}`,  // 'planning-with-files/SKILL.md'
      ...
    });
  }
}
```

---

## 安装后目录结构

```
项目目录/
├── .claude/
│   └── skills/
│       ├── planning-with-files/     # @kanyun/planning-with-files
│       │   ├── SKILL.md             # ✅ 直接在 skill 目录下
│       │   ├── examples.md
│       │   └── scripts/
│       │       └── init-session.sh
│       │
│       └── code-review/             # @kanyun/code-review
│           ├── SKILL.md
│           └── prompts/
│
├── src/
├── package.json
└── ...
```

**符合 AI 工具要求**：`<skill-name>/SKILL.md` 直接可被识别。

---

## 同名冲突处理

当安装目录已存在同名文件夹时，报错并提示用户：

```bash
$ reskill install @other/planning-with-files

❌ Conflict: .claude/skills/planning-with-files/ already exists.

The skill 'planning-with-files' is already installed.
To replace it, first remove the existing directory:
  rm -rf .claude/skills/planning-with-files/
```

---

## 数据库与存储

### 数据库

#### skills 表（v6 新增字段）

| 字段          | 类型 | 默认值       | 说明                                                         |
| ------------- | ---- | ------------ | ------------------------------------------------------------ |
| `name`        | TEXT | —            | 主键，完整名称 `@kanyun/planning-with-files`                 |
| `source_type` | TEXT | `'registry'` | 来源类型：`registry` / `github` / `gitlab` / `oss_url` / `custom_url` / `local` |
| `source_url`  | TEXT | NULL         | 完整 URL（包含 ref 和 path），install 时解析                 |

**数据示例：**

| name                 | source_type | source_url                                                 |
| -------------------- | ----------- | ---------------------------------------------------------- |
| @kanyun/cli-skill    | registry    | NULL                                                       |
| @kanyun/github-skill | github      | https://github.com/user/repo/tree/main/skills/my-skill     |
| @kanyun/local-skill  | local       | local/@kanyun/local-skill.tgz                              |

> **说明**：GitHub/GitLab URL 包含完整的 ref 和 path 信息，install 时通过 `GitResolver.parseGitUrlRef()` 解析。

#### 其他表（无改动）

| 表               | 字段                    | 示例值                                                    |
| ---------------- | ----------------------- | --------------------------------------------------------- |
| `skill_versions` | `(skill_name, version)` | `('@kanyun/planning-with-files', '2.4.5')`                |
| `skill_versions` | `artifact_key`          | `sha256/b4aiu47PSnGA3gqonVgSWrSbFBmWp8su2xEfdGXEp0c=.tgz` |
| `dist_tags`      | `(skill_name, tag)`     | `('@kanyun/planning-with-files', 'latest')`               |

### 查询示例

```sql
-- 1. 查询 skill 信息（包含 source_type）
SELECT name, source_type, source_url
FROM skills
WHERE name = '@kanyun/planning-with-files';

-- 2. Install @kanyun/planning-with-files@latest（仅 source_type='registry' 时）
SELECT sv.artifact_key, sv.version, sv.integrity
FROM dist_tags dt
JOIN skill_versions sv ON dt.skill_name = sv.skill_name AND dt.version = sv.version
WHERE dt.skill_name = '@kanyun/planning-with-files' AND dt.tag = 'latest';

-- 3. Install @kanyun/planning-with-files@2.4.5（仅 source_type='registry' 时）
SELECT artifact_key, integrity
FROM skill_versions
WHERE skill_name = '@kanyun/planning-with-files' AND version = '2.4.5';
```

### OSS 存储（无需改动）

| 项目     | 说明                                 |
| -------- | ------------------------------------ |
| 存储路径 | `sha256/<hash>.tgz`（内容寻址）      |
| 索引方式 | 数据库 `skill_versions.artifact_key` |
| 优势     | 自动去重、不可篡改                   |

---

## 改动清单

### 已完成（v5）

| 组件            | 改动项                                 | 工作量 |
| --------------- | -------------------------------------- | ------ |
| **reskill CLI** | 添加 `PRIVATE_REGISTRIES` 配置         | 小     |
| **reskill CLI** | Publish 路径参数可选（默认当前目录）   | 小     |
| **reskill CLI** | Publish 验证必须是私域 Registry        | 小     |
| **reskill CLI** | Publish 自动添加 scope 前缀            | 小     |
| **reskill CLI** | `createTarball` 使用短名称作为顶层目录 | 小     |
| **reskill CLI** | 实现 `install` 命令                    | 中     |
| **reskill CLI** | Install 解析 `@scope/name@version`     | 小     |
| **reskill CLI** | Install 从 scope 反查 Registry         | 小     |
| **reskill CLI** | Install 自动检测安装目录               | 小     |
| **reskill CLI** | Install 冲突检测与报错                 | 小     |

### 新增（v6 - 适配页面发布）

| 组件            | 改动项                                            | 工作量 |
| --------------- | ------------------------------------------------- | ------ |
| **reskill-app** | skills 表增加 `source_type`/`source_url` 字段     | 小     |
| **reskill-app** | GET /api/skills/:id 返回 source_type 等新字段     | 小     |
| **reskill-app** | 新增 POST /api/skills/publish-web 接口（页面发布）| 中     |
| **reskill CLI** | Install 增加 source_type 分支逻辑                 | 中     |
| **reskill CLI** | 非 registry 模式不支持 @version，增加报错处理     | 小     |
| **reskill CLI** | 复用 GitResolver.parseGitUrlRef() 解析 URL        | 小     |
| **reskill CLI** | 复用 HttpResolver 处理 oss_url/custom_url 来源    | 小     |
| **reskill CLI** | 新增 local 模式下载 OSS 固定路径                  | 小     |

---

## 完整数据流

### Publish 流程

```
cd planning-with-files && reskill publish
        │
        ▼
┌────────────────────────────────────────┐
│            reskill CLI                 │
│                                        │
│  1. 确定 Skill 目录                    │
│     无参数 → process.cwd()             │
│     → /path/to/planning-with-files     │
│                                        │
│  2. 验证 SKILL.md 存在                 │
│                                        │
│  3. 获取 Registry + 验证私域           │
│     → scope = @kanyun                  │
│                                        │
│  4. 构建名称                           │
│     完整名称: @kanyun/planning-with-files │
│     短名称: planning-with-files        │
│                                        │
│  5. 创建 Tarball                       │
│     planning-with-files/               │
│     └── SKILL.md, ...                  │
│                                        │
│  6. 上传（name=完整名称）              │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│          Registry + OSS + DB            │
│                                         │
│  skills.name = @kanyun/planning-with-.. │
│  skill_versions.artifact_key = sha256/..│
│  OSS: sha256/<hash>.tgz                 │
│       └── planning-with-files/SKILL.md  │
└─────────────────────────────────────────┘
```

### Install 流程（v6 更新）

```
reskill install @kanyun/planning-with-files
        │
        ▼
┌────────────────────────────────────────┐
│            reskill CLI                 │
│                                        │
│  1. 解析                               │
│     scope: @kanyun                     │
│     name: planning-with-files          │
│     version: latest                    │
│                                        │
│  2. 从 Scope 反查 Registry             │
│     @kanyun → https://...              │
│                                        │
│  3. 查询 API（用完整名称）             │
│     GET /api/skills/@kanyun/planning.. │
│     → source_type, source_url, ...     │
│                                        │
│  4. 判断 source_type（v6 新增）        │
│     ├── registry → 步骤 5              │
│     └── 其他 → 步骤 4.1                │
│                                        │
│  4.1 页面发布分支（v6 新增）           │
│     ├── 有 @version → 报错 ❌          │
│     └── github/gitlab → Git clone      │
│         oss_url/custom_url → 下载 URL  │
│         local → 下载 OSS               │
│         → 跳到步骤 6                   │
│                                        │
│  5. 下载 + 验证 Integrity              │
│     （仅 registry 模式）               │
│                                        │
│  6. 检测安装目录                       │
│     .claude/ → .claude/skills/         │
│                                        │
│  7. 检查冲突                           │
│     planning-with-files/ 已存在？→ 报错│
│                                        │
│  8. 解压/克隆                          │
│     .claude/skills/planning-with-files/│
│     └── SKILL.md, ...                  │
└────────────────────────────────────────┘
```

### 数据流总览（v6 更新）

```
PUBLISH (CLI):
  ./planning-with-files/
  → CLI: 完整名称 @kanyun/planning-with-files
  → Tarball 内部: planning-with-files/SKILL.md
  → DB: skills.source_type = 'registry'
  → DB: skill_versions.artifact_key = sha256/<hash>.tgz
  → OSS: sha256/<hash>.tgz

PUBLISH (页面 - Remote URL):
  https://github.com/user/repo/tree/main/skills/my-skill
  → DB: skills.source_type = 'github'
  → DB: skills.source_url = 'https://github.com/user/repo/tree/main/skills/my-skill'
  → 不写 skill_versions（URL 包含完整 ref 和 path）

PUBLISH (页面 - Local Folder):
  用户上传文件夹
  → 前端打包 tarball → 上传 OSS
  → DB: skills.source_type = 'local'
  → DB: skills.source_url = 'local/@kanyun/skill-name.tgz'
  → 不写 skill_versions

INSTALL:
  @kanyun/planning-with-files
  → CLI 解析 → API 查询（获取 source_type）
  │
  ├── source_type = 'registry':
  │   → DB: skill_versions → artifact_key
  │   → 下载 OSS: sha256/<hash>.tgz
  │   → 解压
  │
  ├── source_type = 'github/gitlab':
  │   → Git clone source_url (ref, path)
  │
  ├── source_type = 'oss_url/custom_url':
  │   → 直接下载 source_url
  │
  └── source_type = 'local':
      → 下载 OSS: source_url
      → 解压

  → 最终: .claude/skills/planning-with-files/SKILL.md
```

---

## 附录

### 错误信息参考

| 场景                       | 错误信息                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| SKILL.md 不存在            | `SKILL.md not found in /path/to/dir`                                                             |
| 未指定 Registry            | `No registry specified. Set RESKILL_REGISTRY or use --registry`                                  |
| 非私域 Registry            | `Only private registry publishing is supported. Supported: https://reskill-test.zhenguanyu.com/` |
| 未知 Scope                 | `Unknown scope @xxx. Use --registry to specify.`                                                 |
| 同名冲突                   | `Conflict: .claude/skills/xxx/ already exists.`                                                  |
| Integrity 校验失败         | `Integrity check failed. Expected: sha256-xxx, Got: sha256-yyy`                                  |
| 页面发布 skill 指定版本    | `Version specifier not supported for web-published skills. Use: reskill install @scope/skill`    |
| CLI 发布已有页面发布的 skill | `This skill was published via web. Please use the web interface to update it.`                 |
| 页面发布已有 CLI 发布的 skill | `This skill was published via CLI. Please use CLI to publish new versions.`                   |
