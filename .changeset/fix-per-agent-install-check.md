---
"reskill": patch
---

fix(core): make "already installed" check per-agent instead of global

When a skill was installed for one agent (e.g., cursor), installing the same skill to a different agent (e.g., claude-code) was incorrectly skipped with "already installed". The check now verifies per-agent installation status and only skips agents that actually have the skill.

---

fix(core): 将"已安装"检查改为按 agent 维度判断

当一个 skill 已安装到某个 agent（如 cursor）时，再安装到另一个 agent（如 claude-code）会被错误地跳过并提示"已安装"。现在会逐个检查每个目标 agent 的安装状态，仅跳过确实已安装的 agent。
