---
"reskill": minor
---

Auto-generate registries in skills.json

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

---

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
