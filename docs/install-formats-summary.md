# Reskill Install 命令格式汇总

本文档总结 `reskill install` 命令支持的所有格式。

---

## 一、格式分类

### 1. Git-based 格式（现有，已支持）

从 Git 仓库安装 skill。

| 类型                 | 格式示例                                                 | 说明            |
| -------------------- | -------------------------------------------------------- | --------------- |
| GitHub shorthand     | `github:user/skill@v1.0.0`                               | GitHub 简写格式 |
| GitLab shorthand     | `gitlab:group/skill@latest`                              | GitLab 简写格式 |
| Full Git URL (HTTPS) | `https://github.com/user/skill.git`                      | HTTPS URL       |
| Full Git URL (SSH)   | `git@github.com:user/repo.git`                           | SSH 格式        |
| GitHub web URL       | `https://github.com/org/repo/tree/main/skill`            | 自动提取子路径  |
| Private Git registry | `gitlab.company.com:team/skill@v1.0.0`                   | 私有 Git 服务器 |
| Short format         | `user/skill@v1.0.0`                                      | 默认使用 GitHub |
| Monorepo (shorthand) | `github:org/repo/skills/planning@v1.0.0`                 | 带子路径        |
| Monorepo (URL)       | `https://github.com/org/repo.git/skills/planning@v1.0.0` | URL 带子路径    |

**版本格式**：
- `@v1.0.0` - 精确版本
- `@latest` - 最新 tag
- `@^2.0.0` - Semver 范围
- `@branch:dev` - 分支
- `@commit:abc123` - Commit hash
- （无）- 默认分支

### 2. HTTP/OSS URL 格式（现有，已支持）

从 HTTP URL 或云存储直接下载 skill 压缩包。

| 类型                | 格式示例                                                        | 说明             |
| ------------------- | --------------------------------------------------------------- | ---------------- |
| HTTPS URL           | `https://example.com/skills/my-skill.tar.gz`                    | 普通 HTTPS       |
| HTTP URL            | `http://localhost:8080/skills/test-skill.tar.gz`                | 本地开发         |
| 阿里云 OSS (HTTPS)  | `https://bucket.oss-cn-hangzhou.aliyuncs.com/path/skill.tar.gz` | OSS HTTPS        |
| 阿里云 OSS (oss://) | `oss://bucket/path/to/skill.tar.gz`                             | OSS 协议         |
| AWS S3 (s3://)      | `s3://bucket/path/to/skill.tar.gz`                              | S3 协议          |
| 带版本后缀          | `https://example.com/skill-v1.0.0.tar.gz`                       | 从文件名提取版本 |
| 显式版本            | `https://example.com/skill.tar.gz@v1.0.0`                       | URL 后加版本     |

**支持的压缩格式**：
- `.tar.gz` / `.tgz`
- `.zip`
- `.tar`

**版本提取规则**：
1. 优先使用显式版本：`url@v1.0.0`
2. 其次从文件名提取：`skill-v1.0.0.tar.gz` → `v1.0.0`
3. 无版本时默认 `latest`

### 3. Registry-based 格式（已实现）

从 Skill Registry 安装 skill。

| 类型                     | 格式示例                            | Registry URL                        |
| ------------------------ | ----------------------------------- | ----------------------------------- |
| **私有 Registry**        | `@kanyun/planning-with-files`       | `https://rush-test.zhenguanyu.com/` |
| **私有 Registry + 版本** | `@kanyun/planning-with-files@2.4.5` | `https://rush-test.zhenguanyu.com/` |
| **私有 Registry + tag**  | `@kanyun/planning-with-files@beta`  | `https://rush-test.zhenguanyu.com/` |
| **公共 Registry**        | `planning-with-files`               | `https://reskill.info/`             |
| **公共 Registry + 版本** | `planning-with-files@2.4.5`         | `https://reskill.info/`             |
| **公共 Registry + tag**  | `planning-with-files@latest`        | `https://reskill.info/`             |

---

## 二、格式识别逻辑

### 判断流程图

```
输入: reskill install <identifier>
        │
        ▼
┌─────────────────────────────────────────┐
│  1. 是否为 Registry 格式？               │
│     - @scope/name[@version]             │
│     - name[@version] (无 / 无特殊前缀)   │
└─────────────────────────────────────────┘
        │
   ┌────┴────┐
   │ 是      │ 否
   ▼         ▼
Registry    ┌─────────────────────────────────────────┐
格式        │  2. 是否为 HTTP/OSS URL？                │
            │     - http(s)://...                     │
            │     - oss://... / s3://...              │
            │     (排除 .git 和 /tree/ 等 Git URL)    │
            └─────────────────────────────────────────┘
                    │
               ┌────┴────┐
               │ 是      │ 否
               ▼         ▼
            HTTP/OSS    Git-based 格式
            格式        (github:, gitlab:, user/repo, .git URL)
```

**判断优先级**: Registry > HTTP/OSS > Git-based

### 实际代码逻辑

代码位于 `src/core/skill-manager.ts`：

```typescript
// SkillManager.install() 和 SkillManager.installToAgents() 的判断逻辑
async install(ref: string, options: InstallOptions = {}): Promise<InstalledSkill> {
  // Priority: Registry > HTTP > Git
  if (this.isRegistrySource(ref)) {
    return this.installFromRegistry(ref, options);
  }
  if (this.isHttpSource(ref)) {
    return this.installFromHttp(ref, options);
  }
  return this.installFromGit(ref, options);
}
```

### Registry 格式判断 (`RegistryResolver.isRegistryRef()`)

```typescript
// src/core/registry-resolver.ts
static isRegistryRef(ref: string): boolean {
  // 排除 Git SSH 格式 (git@...)
  if (ref.startsWith('git@') || ref.startsWith('git://')) return false;
  
  // 排除 .git 结尾的 URL
  if (ref.includes('.git')) return false;
  
  // 排除 HTTP/HTTPS/OSS URL
  if (ref.startsWith('http://') || ref.startsWith('https://') ||
      ref.startsWith('oss://') || ref.startsWith('s3://')) return false;
  
  // 排除 registry shorthand 格式 (github:, gitlab:)
  if (/^[a-zA-Z0-9.-]+:[^@]/.test(ref)) return false;
  
  // @scope/name 格式 → 私有 Registry
  if (ref.startsWith('@') && ref.includes('/')) {
    return /^@[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+(@[a-zA-Z0-9._-]+)?$/.test(ref);
  }
  
  // name[@version] 格式 → 公共 Registry
  return /^[a-zA-Z0-9._-]+(@[a-zA-Z0-9._-]+)?$/.test(ref);
}
```

### HTTP URL 判断 (`HttpResolver.isHttpUrl()`)

```typescript
// src/core/http-resolver.ts
static isHttpUrl(ref: string): boolean {
  const urlPart = ref.split('@')[0];
  
  // 排除 Git 仓库 URL（以 .git 结尾）
  if (urlPart.endsWith('.git')) return false;
  
  // 排除 GitHub/GitLab web URL（包含 /tree/, /blob/, /raw/）
  if (/\/(tree|blob|raw)\//.test(urlPart)) return false;
  
  // 接受 HTTP/HTTPS/OSS/S3 协议
  return (
    urlPart.startsWith('http://') ||
    urlPart.startsWith('https://') ||
    urlPart.startsWith('oss://') ||
    urlPart.startsWith('s3://')
  );
}
```

---

## 三、使用示例

### Git-based 格式

```bash
# GitHub shorthand
reskill install github:user/skill@v1.0.0

# Full Git URL
reskill install https://github.com/user/skill.git

# GitHub web URL (with branch and subpath)
reskill install https://github.com/vercel-labs/agent-skills/tree/main/skill

# GitLab
reskill install gitlab:group/skill@latest

# Private registry
reskill install gitlab.company.com:team/skill@v1.0.0

# Default registry (from skills.json)
reskill install user/skill@v1.0.0

# Install multiple skills at once
reskill install github:user/skill1 github:user/skill2@v1.0.0
```

### Monorepo 支持

```bash
# Shorthand format with subpath
reskill install github:org/monorepo/skills/planning@v1.0.0
reskill install gitlab:company/skills/frontend/components@latest

# URL format with subpath
reskill install https://github.com/org/monorepo.git/skills/planning@v1.0.0
reskill install git@gitlab.company.com:team/skills.git/backend/apis@v2.0.0

# GitHub web URL automatically extracts subpath
reskill install https://github.com/org/monorepo/tree/main/skills/planning
```

### HTTP/OSS URL 格式

```bash
# HTTPS URL
reskill install https://example.com/skills/my-skill.tar.gz

# 阿里云 OSS - HTTPS 格式
reskill install https://bucket.oss-cn-hangzhou.aliyuncs.com/skills/planning.tar.gz

# 阿里云 OSS - oss:// 协议
reskill install oss://my-bucket/skills/planning.tar.gz

# AWS S3 - s3:// 协议
reskill install s3://my-bucket/skills/planning.tar.gz

# 从文件名自动提取版本
reskill install https://example.com/skills/planning-v1.0.0.tar.gz

# 显式指定版本
reskill install https://example.com/skills/planning.tar.gz@v1.0.0

# 本地开发
reskill install http://localhost:8080/skills/test-skill.tar.gz
```

### Registry-based 格式

```bash
# 私有 Registry - 安装 latest 版本
reskill install @kanyun/planning-with-files

# 私有 Registry - 安装指定版本
reskill install @kanyun/planning-with-files@2.4.5

# 私有 Registry - 安装 beta 标签
reskill install @kanyun/planning-with-files@beta

# 公共 Registry - 安装 latest 版本
reskill install planning-with-files

# 公共 Registry - 安装指定版本
reskill install planning-with-files@2.4.5

# 公共 Registry - 安装指定 tag
reskill install planning-with-files@latest
```

---

## 四、Registry 映射配置

### 私有 Registry Scope 映射

| Scope              | Registry URL                        |
| ------------------ | ----------------------------------- |
| `@kanyun`          | `https://rush-test.zhenguanyu.com/` |
| （localhost 开发） | `http://localhost:3000/`            |

### 公共 Registry

| 条件             | Registry URL            |
| ---------------- | ----------------------- |
| 无 scope，无 `/` | `https://reskill.info/` |

### 配置代码

```typescript
// src/utils/registry-scope.ts

const REGISTRY_SCOPE_MAP: Record<string, string> = {
  'https://rush-test.zhenguanyu.com': '@kanyun',
  'https://rush-test.zhenguanyu.com/': '@kanyun',
  'http://localhost:3000': '@kanyun',
  'http://localhost:3000/': '@kanyun',
};

const PUBLIC_REGISTRY = 'https://reskill.info/';

// 从 scope 反查 Registry
export function getRegistryForScope(scope: string): string | null { ... }

// 获取公共 Registry URL
export function getPublicRegistry(): string {
  return PUBLIC_REGISTRY;
}
```

---

## 五、安装目录

### Canonical 目录

Skills 会安装到 canonical 目录 `.agents/skills/`，然后通过 symlink 链接到各 agent 目录：

```
.agents/skills/                           ← Canonical 目录（实际存储）
├── planning-with-files/
│   ├── SKILL.md
│   └── ...
├── another-skill/
│   └── ...

.claude/skills/planning-with-files/       ← Symlink → .agents/skills/planning-with-files
.cursor/skills/planning-with-files/       ← Symlink → .agents/skills/planning-with-files
```

### 各 Agent 的 skills 目录

| Agent          | Skills 目录              |
| -------------- | ------------------------ |
| Claude Code    | `.claude/skills/`        |
| Cursor         | `.cursor/skills/`        |
| Windsurf       | `.windsurf/skills/`      |
| GitHub Copilot | `.github/skills/`        |
| Codex          | `.agents/skills/`        |
| 其他...        | 参见 `agent-registry.ts` |

### 全局安装

全局安装时目录为 `~/.agents/skills/`。

**注意**：安装目录使用**短名称**（不含 scope），以兼容 AI 编码助手的目录识别。

---

## 六、命令选项

```bash
reskill install <skill> [options]

选项：
  -f, --force           强制重新安装
  -g, --global          安装到全局目录
  --no-save             不保存到 skills.json
  -a, --agent <agents>  指定目标 agent（如 cursor, claude-code）
  --mode <mode>         安装模式：symlink 或 copy
  -y, --yes             跳过确认提示
  --all                 安装到所有 agent
```

---

## 七、错误处理

| 场景         | 错误信息                                                        |
| ------------ | --------------------------------------------------------------- |
| 未知 scope   | `Unknown scope '@xyz'. No registry configured for this scope.`  |
| Skill 不存在 | `Skill '@kanyun/unknown-skill' not found in registry.`          |
| 版本不存在   | `Version '9.9.9' not found for skill '@kanyun/planning'.`       |
| 目录冲突     | `Conflict: .agents/skills/planning-with-files/ already exists.` |
| 网络错误     | `Failed to connect to registry: https://reskill.info/`          |

---

## 八、实现状态

| 格式类型                    |   状态   | 备注                                   |
| --------------------------- | :------: | -------------------------------------- |
| Git-based（全部）           | ✅ 已实现 | 现有功能                               |
| HTTP/OSS URL                | ✅ 已实现 | 现有功能                               |
| `@scope/name` 私有 Registry | ✅ 已实现 | `RegistryResolver` + Step 5.1 CLI 集成 |
| `name` 公共 Registry        | ✅ 已实现 | 同上（待公共 Registry 服务上线后可用） |

---

## 参考链接

- [私有 Registry Publish/Install 设计](./private-registry-publish-install.md)
- [私有 Registry 实施计划](./private-registry-implementation-plan.md)
