---
"reskill": minor
---

Add `--skip-manifest` flag and `RESKILL_NO_MANIFEST` env var to `install` command. When enabled, all `skills.json` and `skills.lock` writes are skipped during installation. Skill files are still installed normally to target agent directories. Intended for platform integration scenarios where the caller manages its own manifest.

---

为 `install` 命令新增 `--skip-manifest` 标志和 `RESKILL_NO_MANIFEST` 环境变量。启用后跳过所有 `skills.json` 和 `skills.lock` 写入，skill 文件仍正常安装到目标 agent 目录。用于平台集成场景，由调用方自行管理 skill 清单。
