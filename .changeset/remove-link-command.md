---
"reskill": minor
---

Remove link and unlink commands

**Breaking Change:**

- Removed `reskill link` command for linking local skills
- Removed `reskill unlink` command for unlinking linked skills
- Removed `link()` and `unlink()` methods from SkillManager API

**Reason:**

The link/unlink functionality was rarely used and added complexity to the codebase. Users can achieve similar results by manually creating symlinks or using the standard install command.

***

移除 link 和 unlink 命令

**破坏性变更：**

- 移除了用于链接本地 skill 的 `reskill link` 命令
- 移除了用于取消链接的 `reskill unlink` 命令
- 移除了 SkillManager API 中的 `link()` 和 `unlink()` 方法

**原因：**

link/unlink 功能使用率较低，且增加了代码复杂度。用户可以通过手动创建符号链接或使用标准的 install 命令实现类似效果。
