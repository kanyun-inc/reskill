---
"reskill": minor
---

feat(outdated): support registry source detection and global skill checking

- Fix `reskill outdated` not detecting registry-sourced skills (previously only handled Git sources)
- Add `-g, --global` flag to check globally installed skills (`~/.agents/skills/`)
- Add prerelease channel-aware version comparison: stable users only see stable updates, beta users only see beta updates — no cross-channel noise
- For unscoped global skills, probe known registries to find the source package

---

feat(outdated): 支持 registry 来源检测和全局 skill 检查

- 修复 `reskill outdated` 无法检测 registry 来源的 skill（之前只处理 Git 来源）
- 新增 `-g, --global` 参数，支持检查全局安装的 skill（`~/.agents/skills/`）
- 新增预发布版本通道感知：正式版用户只看到正式版更新，beta 用户只看到 beta 更新，不会跨通道提示
- 对无 scope 的全局 skill，自动探测已知 registry 查找源包
