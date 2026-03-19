---
"reskill": minor
---

Add group management CLI and group-path publish support.

**Changes:**
- Add `reskill group` command family for listing, creating, inspecting, deleting groups, and managing group members
- Add `group list --tree` mode with `flat=true` API query support
- Enforce client-side group path normalization and validation (depth/segment/slug constraints)
- Add `publish --group <path>` to attach `group_path` during publish
- Add registry client APIs for group resolve/list/create/delete/member operations, with URL-safe member removal query handling

---

新增 Group 管理 CLI，并支持基于 Group 路径发布技能。

**变更:**
- 新增 `reskill group` 命令族，支持 Group 列表、创建、详情、删除与成员管理
- 新增 `group list --tree` 模式，并支持 `flat=true` 查询参数
- 在客户端增加 Group path 规范化与校验（层级/分段长度/slug 约束）
- 新增 `publish --group <path>`，发布时携带 `group_path`
- 在 registry client 中新增 Group 相关 API，并修复成员移除请求的 URL 编码问题
