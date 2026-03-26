---
"reskill": patch
---

Allow version specifier for local source_type skill install.

Local-published skills now support `@version` during install (e.g., `reskill install @scope/skill@1.0.0`). Previously, all web-published skills uniformly rejected version specifiers, but the registry backend already supports multi-version for local skills.

---

允许 local source_type 的 skill 在安装时指定版本号。

本地发布的 skill 现在支持 `@version` 安装（如 `reskill install @scope/skill@1.0.0`）。此前所有 web 发布的 skill 统一拒绝版本号，但 registry 后端已支持 local skill 的多版本。
