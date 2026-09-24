---
"reskill": patch
---

Fix Codex project-level skills directory

Codex now discovers project-level skills from `.agents/skills/`, but reskill was still installing them to `.codex/skills/`. The project-level `skillsDir` for the `codex` agent has been corrected to `.agents/skills`. The global directory remains `~/.codex/skills`.

---

修复 Codex 项目级 skill 安装目录

最新版 Codex 从 `.agents/skills/` 发现项目级 skill，但 reskill 仍将其安装到 `.codex/skills/`。已将 `codex` agent 的项目级 `skillsDir` 修正为 `.agents/skills`，全局目录保持 `~/.codex/skills` 不变。
