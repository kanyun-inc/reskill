---
"reskill": patch
---

fix(core): correct version resolution for globally-installed skills

- `list -g` (and `-a <agent>` per-agent listing) no longer reports the literal string `"local"` as the version for symlinked installs — symlink is the default install mode, so this previously hid the real version for nearly every global install
- Version resolution now falls back to `.reskill-source.json` (written for global/no-manifest installs) before giving up with `"unknown"`, matching the documented priority `locked > sourceMeta > SKILL.md > 'unknown'`
- `outdated -g`'s registry probe no longer persists the literal string `"unknown"` back into `.reskill-source.json` when the current version was never known — it now records the resolved latest version as a best-effort baseline, so `list -g` shows a real version after running `outdated -g` once, and future update checks have something to compare against
- Install now writes `.reskill-source.json` into the Claude Cowork 3P app-managed directory (not just the canonical location) when it's a target agent — Claude 3P installs live entirely outside the canonical/symlink tree, so the resolved version was previously never recorded there and `list()` fell back to whatever `version:` happened to be baked into the copied SKILL.md, which can drift from the registry version that was actually installed. Also guards against creating a content-less "ghost" canonical directory for claude-3p-only / copy-only installs, which could otherwise shadow the real per-agent entry in `list()`

---

fix(core): 修复全局安装 skill 的版本解析问题

- `list -g`(以及 `-a <agent>` 的按 agent 查询)不再把 symlink 安装的 skill 版本显示成字面量字符串 `"local"`——symlink 是默认安装模式，这个问题此前会掩盖几乎所有全局安装的真实版本号
- 版本解析在落到 `"unknown"` 之前会先读取 `.reskill-source.json`（全局/无 manifest 安装时写入），与文档中 `locked > sourceMeta > SKILL.md > 'unknown'` 的优先级保持一致
- `outdated -g` 的 registry 探测在当前版本从未知晓时，不再把字面量 `"unknown"` 回写进 `.reskill-source.json`——现在会把探测到的最新版本作为兜底基线写入，跑一次 `outdated -g` 之后 `list -g` 就能显示真实版本号，后续的更新检测也有了可比对的基准
- 安装时，只要目标 agent 里有 Claude Cowork 3P，现在也会把 `.reskill-source.json` 写进 3P 自己的 App 管理目录（不再只写 canonical 目录）——3P 的安装完全在 canonical/symlink 体系之外，之前解析出的真实版本号从未记录到那里，`list()` 只能退回去读拷贝过去的 SKILL.md 里的 `version:` 字段，而这个字段可能跟实际安装的 registry 版本不一致。同时避免了给纯 3P-only / copy 安装凭空造出一个只有 `.reskill-source.json`、没有真实内容的"幽灵" canonical 目录（否则会在 `list()` 里把真实的 per-agent 记录顶替掉）
