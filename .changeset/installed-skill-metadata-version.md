---
'reskill': patch
---

Read `metadata.version` from SKILL.md when a skill has no top-level `version`, matching `reskill publish`. `list`, `info` and `outdated -g` no longer show `unknown` for such skills, and installs from Git, HTTP and multi-skill repositories record it as the locked version (the Git/HTTP ref is still stored and used for update checks). Fixes #489

---

当 SKILL.md 没有顶层 `version` 时，读取 `metadata.version` 作为版本，与 `reskill publish` 的取值保持一致。这类技能在 `list`、`info`、`outdated -g` 中不再显示 `unknown`；从 Git、HTTP 和多技能仓库安装时，也会把它记录为锁定版本（Git/HTTP ref 仍然单独保存，并继续用于更新检查）。修复 #489
