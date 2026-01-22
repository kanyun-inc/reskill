---
"reskill": patch
---

Fix three issues in the installation flow:

1. **Fix `.reskill-commit` file leakage**: The internal metadata file `.reskill-commit` is no longer copied to the target skill directory during installation
2. **Auto-create `skills.json` on first install**: When installing a skill in a project without `skills.json`, the config file is now automatically initialized
3. **Smart error tips based on URL type**: Git clone failure messages now show authentication tips specific to the URL type (SSH or HTTPS) instead of showing all tips

---

修复安装流程中的三个问题：

1. **修复 `.reskill-commit` 文件泄漏**：安装 skill 时不再将内部元数据文件 `.reskill-commit` 复制到目标目录
2. **首次安装时自动创建 `skills.json`**：在没有 `skills.json` 的项目中安装 skill 时，会自动初始化配置文件
3. **智能化错误提示**：Git clone 失败时，根据 URL 类型（SSH/HTTPS）显示对应的认证提示
