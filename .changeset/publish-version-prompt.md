---
"reskill": patch
---

Improve publish command UX when version is missing in SKILL.md

**Changes:**
- Interactive mode now prompts user to enter version number when missing
- Empty input cancels publish, allowing user to add version to SKILL.md first
- Fixed confirm prompt default to Yes (Y/n) - press Enter to confirm
- Fixed warning display: no longer shows "No version specified" after user provides version

**Backward Compatibility:**
- `--yes` and `--dry-run` modes continue using 0.0.0 as default (unchanged)

---

改进 publish 命令在 SKILL.md 缺少 version 时的用户体验

**变更：**
- 交互模式下，缺少版本时会提示用户输入版本号
- 留空取消发布，方便用户先在 SKILL.md 中补充 version
- 修复确认提示默认值为 Yes (Y/n) - 按 Enter 直接确认
- 修复警告显示：用户输入版本后不再显示"未指定版本"警告

**向后兼容：**
- `--yes` 和 `--dry-run` 模式仍使用 0.0.0 作为默认值（无变化）
