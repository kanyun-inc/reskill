---
"reskill": patch
---

Fix uninstall command to properly clean up all agent directories

**Bug Fix:**

- The `uninstall` command now correctly removes all agent-specific directories when uninstalling a skill
- Ensures complete cleanup of skill files and prevents leftover directories

***

修复 uninstall 命令，正确清理所有 agent 目录

**问题修复：**

- `uninstall` 命令现在会正确移除所有与 agent 相关的目录
- 确保完全清理 skill 文件，防止遗留目录
