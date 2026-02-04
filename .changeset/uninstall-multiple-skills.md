---
"reskill": minor
---

Support uninstalling multiple skills at once

**Changes:**
- `uninstall` command now accepts multiple skill names as arguments
- Shows summary of all skills to be uninstalled before confirmation
- Warns about skills that are not installed while still uninstalling the valid ones
- Updated help text to show `<skills...>` instead of `<skill>`

**Usage:**
```bash
reskill uninstall skill-one skill-two skill-three -y
```

---

支持一次性卸载多个 skills

**变更：**
- `uninstall` 命令现在接受多个 skill 名称作为参数
- 在确认前显示所有要卸载的 skills 摘要
- 对未安装的 skills 发出警告，同时继续卸载有效的 skills
- 更新帮助文本，显示 `<skills...>` 而不是 `<skill>`

**用法：**
```bash
reskill uninstall skill-one skill-two skill-three -y
```
