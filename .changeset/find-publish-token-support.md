---
"reskill": minor
---

feat: add --token support to find and publish commands

The `find` and `publish` commands now accept `--token` for authenticated registry requests, consistent with `install`. Token resolution priority: `--token` flag > `RESKILL_TOKEN` env > `~/.reskillrc`.

This enables agent environments to pass platform tokens for searching and publishing private skills without prior `reskill login`.

Note: `publish` uses `--token` (long only) since `-t` is taken by `--tag`.

---

feat: find 和 publish 命令新增 --token 参数

`find` 和 `publish` 命令现在支持 `--token` 参数进行认证请求，与 `install` 保持一致。Token 优先级：`--token` 参数 > `RESKILL_TOKEN` 环境变量 > `~/.reskillrc` 配置。

适用于 agent 环境中无需 `reskill login` 即可搜索和发布私有 skill 的场景。

注意：`publish` 使用 `--token`（仅长选项），因为 `-t` 已被 `--tag` 占用。
