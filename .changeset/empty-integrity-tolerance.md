---
"reskill": patch
---

Tolerate empty `x-integrity` header from registry for local-mode publishes.

**Bug Fixes:**
- Fix `Invalid integrity format:` install failure when registry returns an empty `x-integrity` header. Per the rush-v2 server spec (§3.2a/3.2b), local-mode publishes (skills uploaded as multipart tarballs via the Web UI) intentionally store `integrity = ''` and the download endpoint propagates that empty value. The CLI now skips integrity verification in this case instead of throwing, while still verifying every non-empty integrity value as before.

---

兼容 registry 在 local 模式发布时返回的空 `x-integrity` header。

**Bug Fixes:**
- 修复 registry 返回空 `x-integrity` header 时安装报错 `Invalid integrity format:` 的问题。按 rush-v2 服务端契约（§3.2a/3.2b），local 模式发布的 skill（通过 Web UI 上传 multipart tarball）会有意将 `integrity` 存为空串，下载接口照样透传该空值。CLI 现在在这种情况下跳过完整性校验而不是抛错，对所有非空 integrity 仍按原有逻辑严格校验。
