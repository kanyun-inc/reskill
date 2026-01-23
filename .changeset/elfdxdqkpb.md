---
"reskill": patch
---

Fix repository URL in package.json for npm provenance verification

**Bug Fixes:**
- Updated `repository.url` to match the actual GitHub repository (`kanyun-inc/reskill`)
- Fixed `homepage` and `bugs.url` to point to the correct repository
- This resolves npm publish failures caused by sigstore provenance verification mismatch

---

修复 package.json 中的仓库 URL 以通过 npm 来源验证

**Bug Fixes:**
- 更新 `repository.url` 以匹配实际的 GitHub 仓库 (`kanyun-inc/reskill`)
- 修复 `homepage` 和 `bugs.url` 指向正确的仓库地址
- 解决了因 sigstore 来源验证不匹配导致的 npm 发布失败问题
