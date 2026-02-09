---
"reskill": minor
---

Auto-generate Cursor .mdc bridge rule files on skill install

**Changes:**
- When installing a skill to the Cursor agent (project-level), automatically create a `.cursor/rules/<skill-name>.mdc` bridge file
- Bridge file references `SKILL.md` via `@file` directive so Cursor can discover and activate the skill
- On uninstall, auto-generated bridge files are cleaned up (manually created `.mdc` files are preserved)
- Skipped for global installs and non-cursor agents

---

安装 skill 到 Cursor 时自动生成 .mdc 桥接规则文件

**变更：**
- 安装 skill 到 Cursor agent（项目级）时，自动在 `.cursor/rules/<skill-name>.mdc` 创建桥接文件
- 桥接文件通过 `@file` 指令引用 `SKILL.md`，使 Cursor 能够发现和激活 skill
- 卸载时自动清理桥接文件（手动创建的 `.mdc` 文件不受影响）
- 全局安装和非 Cursor agent 不创建桥接文件
