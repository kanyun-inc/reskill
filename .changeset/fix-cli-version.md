---
"reskill": patch
---

Fix CLI version display to read from package.json instead of hardcoded value

**Bug Fix:**

- The `--version` flag now dynamically reads the version from `package.json` instead of using a hardcoded `0.1.0` value
- This ensures the CLI always displays the correct version number after releases

**Technical Changes:**

- Added dynamic import of `package.json` in `src/cli/index.ts`
- Used Node.js built-in modules (`fs`, `path`, `url`) to resolve the package.json path at runtime
- Replaced hardcoded `.version('0.1.0')` with `.version(packageJson.version)`

***

修复 CLI 版本显示，从 package.json 读取而非硬编码

**问题修复：**

- `--version` 参数现在动态读取 `package.json` 中的版本号，而不是使用硬编码的 `0.1.0`
- 确保 CLI 在发版后始终显示正确的版本号

**技术变更：**

- 在 `src/cli/index.ts` 中动态导入 `package.json`
- 使用 Node.js 内置模块（`fs`、`path`、`url`）在运行时解析 package.json 路径
- 将硬编码的 `.version('0.1.0')` 替换为 `.version(packageJson.version)`
