---
"reskill": patch
---

Fix Windows registry tarball extraction and Claude 3P default path

**Bug Fixes:**
- Fix tarball extraction silently failing on Windows. `isPathSafe()` in the tarball extractor compared resolved paths with a hardcoded `/` separator, which never matches Windows `\` paths, so every entry was rejected and skills extracted into an empty directory (causing `ENOENT ... scandir` during install). The containment check now uses `path.relative`, making it separator-agnostic.
- Fix the default Claude Cowork 3P (`claude-cowork-3p`) skills base path on Windows. It now resolves to `%LOCALAPPDATA%` (Local) instead of `%APPDATA%` (Roaming), matching where Claude Desktop 3P actually stores its data. Falls back to `<home>/AppData/Local` when `LOCALAPPDATA` is unset.

macOS and Linux behavior is unchanged.

---

修复 Windows 下注册表 tarball 解压以及 Claude 3P 默认路径问题

**Bug 修复:**
- 修复 Windows 下 tarball 解压静默失败的问题。解压器中的 `isPathSafe()` 使用硬编码的 `/` 分隔符比较解析后的路径，在 Windows 的 `\` 路径下永远不匹配，导致所有条目被拒绝、skill 解压到空目录（安装时报 `ENOENT ... scandir`）。现改用 `path.relative` 做包含性校验，与分隔符无关。
- 修复 Windows 下 Claude Cowork 3P（`claude-cowork-3p`）默认 skills 路径。现在解析到 `%LOCALAPPDATA%`（Local）而非 `%APPDATA%`（Roaming），与 Claude Desktop 3P 实际存储位置一致；当 `LOCALAPPDATA` 未设置时回退到 `<home>/AppData/Local`。

macOS 与 Linux 行为保持不变。
