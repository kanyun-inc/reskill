---
"reskill": minor
---

Use login-cli endpoint for CLI authentication

**Changes:**
- Add `loginCli()` method to RegistryClient for CLI authentication
- Update `login` command to call `POST /api/auth/login-cli` instead of `GET /api/auth/me`
- Save user email from login response to `~/.reskillrc`

---

使用 login-cli 端点进行 CLI 认证

**变更:**
- 在 RegistryClient 中添加 `loginCli()` 方法用于 CLI 认证
- 更新 `login` 命令，调用 `POST /api/auth/login-cli` 替代 `GET /api/auth/me`
- 将登录响应中的用户邮箱保存到 `~/.reskillrc`
