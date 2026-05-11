---
"reskill": patch
---

Fix: treat claude-cowork-3p installations as effectively global

When installing skills exclusively to `claude-cowork-3p` agent (without `--global` flag), the installation was incorrectly writing to project-level `skills.json` and `skills.lock`. Since claude-cowork-3p always installs to a global app-managed directory, these writes are now skipped unless other non-global agents are also targeted.

---

修复：将 claude-cowork-3p 安装视为等效全局安装

当仅安装 skill 到 `claude-cowork-3p` agent（未传 `--global`）时，之前会错误地写入项目级别的 `skills.json` 和 `skills.lock`。由于 claude-cowork-3p 始终安装到全局的应用管理目录，现在除非同时涉及其他非全局 agent，否则跳过这些写入。
