---
"reskill": patch
---

Fix install command to respect installDir configuration from skills.json

**Bug Fixes:**
- Fixed an issue where `reskill install` ignored the `installDir` setting in `skills.json`
- Skills are now correctly installed to the configured directory instead of always using `.agents/skills/`

---

修复 install 命令以正确使用 skills.json 中的 installDir 配置

**Bug 修复：**
- 修复了 `reskill install` 忽略 `skills.json` 中 `installDir` 设置的问题
- 技能现在会正确安装到配置的目录，而不是总是使用 `.agents/skills/`
