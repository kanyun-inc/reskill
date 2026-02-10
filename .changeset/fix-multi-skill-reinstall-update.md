---
"reskill": patch
---

Fix reinstall/update failure for multi-skill repo references with #skillName fragment

**Bug:**
When `skills.json` stores references in `github:user/repo#skillName` format (saved during multi-skill repo installation), running `install` (no args, reinstall all) or `update` would append `#skillName` to the git clone URL, causing a clone failure like: `Failed to clone repository: https://github.com/anthropics/skills#pdf`.

**Changes:**
- Strip `#fragment` in `parseRef()` before URL construction, storing it as `skillName` on `ParsedSkillRef`
- Add `resolveSourcePath()` helper to locate the correct skill subdirectory in cached multi-skill repos
- Use `resolveSourcePath()` in both `installFromGit()` and `installToAgentsFromGit()` so reinstall and update correctly find the skill within the cloned repo

**Bug Fixes:**
- `install` (reinstall all from skills.json) now works with `ref#skillName` entries
- `update <skill>` now works with `ref#skillName` entries
- `outdated` check no longer fails on `ref#skillName` entries

---

修复多技能仓库 #skillName 格式引用的 reinstall/update 失败问题

**Bug:**
当 `skills.json` 中存储了 `github:user/repo#skillName` 格式的引用（多技能仓库安装时保存），执行 `install`（无参数重装全部）或 `update` 时，会将 `#skillName` 拼接到 git clone URL 中，导致克隆失败，例如：`Failed to clone repository: https://github.com/anthropics/skills#pdf`。

**Changes:**
- 在 `parseRef()` 中构建 URL 前剥离 `#fragment`，存入 `ParsedSkillRef.skillName` 字段
- 新增 `resolveSourcePath()` 辅助方法，在缓存的多技能仓库中定位正确的 skill 子目录
- 在 `installFromGit()` 和 `installToAgentsFromGit()` 中使用 `resolveSourcePath()`，使 reinstall 和 update 能正确找到仓库中的 skill

**Bug Fixes:**
- `install`（从 skills.json 重装全部）现在可以正确处理 `ref#skillName` 条目
- `update <skill>` 现在可以正确处理 `ref#skillName` 条目
- `outdated` 检查不再因 `ref#skillName` 条目而失败
