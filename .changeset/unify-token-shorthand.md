---
"reskill": minor
---

Unify `-t` shorthand to always mean `--token` across all commands. Previously, `publish` used `-t` for `--tag` and had no shorthand for `--token`. Now `-t` consistently maps to `--token` in all commands, and `--tag` is long-only.

---

统一 `-t` 短选项在所有命令中均表示 `--token`。此前 `publish` 命令中 `-t` 表示 `--tag`，`--token` 无短选项。现在 `-t` 在所有命令中一致映射到 `--token`，`--tag` 仅支持长选项。
