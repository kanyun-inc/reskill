---
"reskill": minor
---

Auto-detect multi-skill parent directories and install all child skills

**Features:**
- When the install target has no root SKILL.md but contains subdirectories with SKILL.md files, reskill now automatically discovers and installs all child skills, instead of treating the entire directory as one skill
- Add `detectSkillsInRef()` to SkillManager for single vs multi-skill detection
- Add `installAutoDetectedMultiSkill()` in CLI with summary, confirmation prompt, and result display

**Code Quality:**
- Remove unused `cacheResult` variable in `detectSkillsInRef()` — only the caching side-effect is needed
- Add detailed comments explaining why `cachePath` (not `sourcePath`) is correct for discovery scan scope
- Add unit test validating that `detectSkillsInRef` with subPath refs only discovers skills within the scoped subdirectory

---

自动检测多 skill 父目录并安装所有子 skill

**新功能：**
- 当安装目标没有根 SKILL.md 但包含带有 SKILL.md 文件的子目录时，reskill 现在会自动发现并安装所有子 skill，而不是将整个目录视为一个 skill
- 在 SkillManager 中新增 `detectSkillsInRef()` 用于单/多 skill 检测
- 在 CLI 中新增 `installAutoDetectedMultiSkill()`，包含摘要展示、确认提示和结果显示

**代码质量：**
- 移除 `detectSkillsInRef()` 中未使用的 `cacheResult` 变量 — 仅需缓存副作用
- 补充详细注释，说明 discovery 扫描使用 `cachePath`（而非 `sourcePath`）的正确性
- 新增单元测试，验证带 subPath 的 ref 只发现子目录范围内的 skill
