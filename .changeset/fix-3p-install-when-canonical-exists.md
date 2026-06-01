---
"reskill": patch
---

Fix `install` silently skipping the target agent when the canonical skill directory already exists but the lock file is missing or holds a different version.

**Bug Fixes:**
- `installToAgentsFromRegistry` no longer returns a fake success when the canonical `~/.agents/skills/<name>` directory exists but the target agent (e.g. `claude-cowork-3p`) is still missing the skill. The CLI now reuses the cached canonical copy to install into the missing agent's directory and reports the agent-specific install path instead of the canonical one. Most user-visible scenario: `reskill install @scope/foo@latest -a claude-cowork-3p` after a previous global install would warn "already installed" and never touch the Claude Cowork 3P skills root.
- The "already installed. Use --force to reinstall." warning now only fires when every target agent already has the skill, matching user expectations.

---

修复 `install` 命令在画布技能目录（canonical）已存在但 lock 文件缺失或版本不一致时，会跳过目标 agent 的安装并伪造成功的问题。

**Bug Fixes:**
- `installToAgentsFromRegistry` 不再在 `~/.agents/skills/<name>` 已存在、但目标 agent（如 `claude-cowork-3p`）仍未安装该 skill 时返回假成功。CLI 会复用 canonical 缓存目录，把 skill 实际拷贝到缺失的 agent 目录下，并在结果中报告该 agent 自己的安装路径，而不是 canonical 路径。最常见的触发场景：之前做过全局安装后，再执行 `reskill install @scope/foo@latest -a claude-cowork-3p` 时，旧版本会提示 "already installed" 并完全跳过对 Claude Cowork 3P skills 根目录的写入。
- "already installed. Use --force to reinstall." 警告现在仅在所有目标 agent 都已安装该 skill 时才会出现，与用户预期一致。
