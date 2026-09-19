---
"reskill": patch
---

Fix `install --all` to target only detected agents instead of all 18 known agent types. On machines where platform-specific agents are unavailable (e.g. Claude Cowork 3P on Linux), the previous behavior produced guaranteed failures like "Claude Cowork 3P skills root not found". `--all` now runs agent detection first and falls back to all known agent types only when nothing is detected.

---

修复 `install --all` 只安装到检测到的 Agent，而不是全部 18 种已知 Agent 类型。在某些 Agent 不可用的环境下（例如 Linux 上没有 Claude Cowork 3P），原先行为会必然失败并报出 "Claude Cowork 3P skills root not found"。`--all` 现在会先做 Agent 检测，只有全部没检测到时才回退到所有已知 Agent 类型。
