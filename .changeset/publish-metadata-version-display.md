---
'reskill': patch
---

Fix `reskill publish` showing `0.0.0` in the preview, confirmation prompt, and validation output when the version is only declared as `metadata.version` in SKILL.md. The displayed version now matches the version sent in the publish payload (top-level `version` still takes precedence). Fixes #487

---

修复 `reskill publish` 在 SKILL.md 仅通过 `metadata.version` 声明版本时，预览、确认提示及校验输出错误显示 `0.0.0` 的问题。现在展示的版本与实际发布载荷中的版本一致（顶层 `version` 仍然优先）。修复 #487
