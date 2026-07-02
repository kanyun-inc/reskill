---
"reskill": patch
---

fix(core): correct version resolution for globally-installed skills

- `list -g` (and `-a <agent>` per-agent listing) no longer reports the literal string `"local"` as the version for symlinked installs — symlink is the default install mode, so this previously hid the real version for nearly every global install
- Version resolution now falls back to `.reskill-source.json` (written for global/no-manifest installs) before giving up with `"unknown"`, matching the documented priority `locked > sourceMeta > SKILL.md > 'unknown'`
- `outdated -g`'s registry probe no longer persists the literal string `"unknown"` back into `.reskill-source.json` when the current version was never known — it now records the resolved latest version as a best-effort baseline, so `list -g` shows a real version after running `outdated -g` once, and future update checks have something to compare against

---

fix(core): 修复全局安装 skill 的版本解析问题

- `list -g`(以及 `-a <agent>` 的按 agent 查询)不再把 symlink 安装的 skill 版本显示成字面量字符串 `"local"`——symlink 是默认安装模式，这个问题此前会掩盖几乎所有全局安装的真实版本号
- 版本解析在落到 `"unknown"` 之前会先读取 `.reskill-source.json`（全局/无 manifest 安装时写入），与文档中 `locked > sourceMeta > SKILL.md > 'unknown'` 的优先级保持一致
- `outdated -g` 的 registry 探测在当前版本从未知晓时，不再把字面量 `"unknown"` 回写进 `.reskill-source.json`——现在会把探测到的最新版本作为兜底基线写入，跑一次 `outdated -g` 之后 `list -g` 就能显示真实版本号，后续的更新检测也有了可比对的基准
