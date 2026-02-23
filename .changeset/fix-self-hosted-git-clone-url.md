---
"reskill": patch
---

Fix self-hosted GitLab/GitHub clone URL for web-published skills

**Problem:**
When installing a web-published skill from a self-hosted GitLab instance (e.g., `gitlab.internal.example.com`),
the CLI constructed a `gitlab:owner/repo` shorthand ref. The `buildRepoUrl` method resolved
`gitlab` via `DEFAULT_REGISTRIES` to `https://gitlab.com`, losing the original self-hosted host
and causing `git clone` to target the wrong server.

**Root Cause:**
`buildGitRefForWebPublished` always used `sourceType` (e.g., `"gitlab"`) as the ref prefix,
regardless of whether the actual host was the standard `gitlab.com` or a self-hosted instance.

**Fix:**
- Added `isStandardHost` method to detect whether the host matches `github.com` / `gitlab.com`
- For self-hosted hosts, the ref now uses the hostname as prefix (e.g., `gitlab.internal.example.com:owner/repo/path`)
  instead of the generic `gitlab:` shorthand
- `getRegistryUrl` fallback (`https://{registryName}`) correctly resolves self-hosted hostnames
- Standard hosts continue to use `github:` / `gitlab:` shorthand (no behavior change)

---

修复自托管 GitLab/GitHub 的 clone URL 错误

**问题：**
从自托管 GitLab 安装 web 发布的 skill 时，CLI 构造了 `gitlab:owner/repo` 格式的 shorthand ref。
`buildRepoUrl` 通过 `DEFAULT_REGISTRIES` 将 `gitlab` 解析为 `https://gitlab.com`，
丢失了原始的自托管主机地址，导致 `git clone` 指向错误的服务器。

**根因：**
`buildGitRefForWebPublished` 始终使用 `sourceType`（如 `"gitlab"`）作为 ref 前缀，
未区分标准主机（`gitlab.com`）和自托管主机。

**修复：**
- 新增 `isStandardHost` 方法检测 host 是否为 `github.com` / `gitlab.com`
- 自托管主机使用完整域名作为前缀（如 `gitlab.internal.example.com:owner/repo/path`），
  而非通用的 `gitlab:` shorthand
- `getRegistryUrl` 的 fallback 逻辑（`https://{registryName}`）正确还原自托管地址
- 标准主机继续使用 `github:` / `gitlab:` shorthand（行为不变）
