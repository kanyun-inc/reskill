---
"reskill": minor
---

Add interactive token prompt for `login` command

**Changes:**
- `reskill login` now guides users through token setup with step-by-step instructions and a link to the registry's token settings page
- Token input uses a fixed-length mask (`••••••••`) for visual feedback without revealing token length
- Empty input shows "Token cannot be empty" warning and retries instead of exiting
- Non-interactive mode (`reskill login --token <token>`) available for CI/CD pipelines
- Updated README to document both interactive and non-interactive login modes

---

为 `login` 命令添加交互式 token 输入

**变更:**
- `reskill login` 现在会引导用户完成 token 设置，提供分步说明和 registry token 设置页面链接
- Token 输入使用固定长度遮盖符（`••••••••`），提供视觉反馈且不暴露 token 长度
- 空输入会提示 "Token cannot be empty" 并重试，而不是直接退出
- 非交互式模式（`reskill login --token <token>`）适用于 CI/CD 流水线
- 更新 README 文档，说明交互式和非交互式两种登录方式
