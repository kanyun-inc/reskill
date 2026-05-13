---
"reskill": patch
---

Surface the underlying cause when a registry/OSS network request fails

**Bug Fixes:**
- `RegistryClient` now wraps every `fetch()` call so that low-level network failures (DNS, TCP reset, TLS handshake, connect timeout) no longer surface as a bare `fetch failed`. The thrown `RegistryError` includes the URL (with query string stripped to avoid leaking signed-URL signatures) and the undici `cause.code` / `cause.message` (e.g. `ENOTFOUND`, `UND_ERR_CONNECT_TIMEOUT`).
- Improves triage for install failures against `@kanyun/*` skills hosted on `rush.zhenguanyu.com`, where users previously only saw `■ fetch failed` with no way to tell whether the registry API or the OSS storage hop was at fault.

---

让 registry / OSS 网络请求失败时打印出真实原因

**Bug 修复:**
- `RegistryClient` 现在统一通过内部 `safeFetch` 调用 `fetch()`，DNS、TCP reset、TLS 握手、连接超时等底层网络错误不再只显示 `fetch failed`。抛出的 `RegistryError` 会带上请求 URL（已剥除 query string，避免泄露签名 URL 的签名信息）以及 undici 的 `cause.code` / `cause.message`（例如 `ENOTFOUND`、`UND_ERR_CONNECT_TIMEOUT`）。
- 主要改善 `rush.zhenguanyu.com` 上 `@kanyun/*` skill 安装失败时的可观测性，用户之前只能看到 `■ fetch failed`，无法判断是 registry API 还是 OSS 那一跳出问题。
