---
"reskill": patch
---

Fix `install` failing on Git repositories whose default branch is not `main`.

Previously, when a skill reference had no version spec (e.g. `@scope/my-skill` or `gitlab-host:owner/repo/subpath`), reskill hard-coded the clone ref to `main`. This broke installs on any repo whose real default branch was something else (most commonly `master` on self-hosted GitLab EE instances).

Now the resolver introduces a new `'default'` version type. When no version spec is provided, reskill auto-detects the repository's actual default branch via `git ls-remote --symref <repoUrl> HEAD` (the same mechanism already used by `@latest` when no tags exist). Explicit `@branch:main` / `@main` (exact tag) references continue to work unchanged.

---

修复默认分支不是 `main` 的 Git 仓库无法 `install` 的问题。

此前未指定版本（如 `@scope/my-skill` 或 `gitlab-host:owner/repo/subpath`）时，reskill 会把 clone 分支硬编码为 `main`，导致默认分支为其他名字的仓库（最常见的是自托管 GitLab EE 上的 `master` 仓库）无法安装。

现在解析器新增 `'default'` 版本类型：未指定版本时通过 `git ls-remote --symref <repoUrl> HEAD` 自动探测仓库真实的默认分支（与 `@latest` 无 tag 时的回退机制一致）。显式指定 `@branch:main` / `@main`（精确 tag）的行为保持不变。
