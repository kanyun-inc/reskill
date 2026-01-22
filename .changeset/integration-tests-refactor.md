---
"reskill": patch
---

Refactor integration tests from shell script to Vitest

**Changes:**
- Replace `scripts/integration-test.sh` with Vitest integration tests
- Split tests into 6 files by functionality: basic, install-copy, install-symlink, install-global, uninstall, update
- Add shared test helpers in `src/cli/commands/__integration__/helpers.ts`
- Create separate vitest config `vitest.integration.config.ts` for integration tests
- Update CI workflow to use `pnpm test:integration`

---

重构集成测试，从 shell 脚本迁移到 Vitest

**主要变更：**
- 用 Vitest 集成测试替换 `scripts/integration-test.sh`
- 按功能拆分为 6 个测试文件：basic、install-copy、install-symlink、install-global、uninstall、update
- 在 `src/cli/commands/__integration__/helpers.ts` 中添加共享测试工具
- 创建独立的 vitest 配置文件 `vitest.integration.config.ts`
- 更新 CI 工作流使用 `pnpm test:integration`
