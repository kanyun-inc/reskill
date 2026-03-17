---
"reskill": patch
---

Add Chinese pattern detection for prompt-injection and stealth-instructions rules

**Changes:**
- Add 11 Chinese regex patterns to prompt-injection rule (high risk)
- Add 6 Chinese patterns + 1 safe exclusion to stealth-instructions rule (medium risk)
- Fix multilingual bypass vulnerability where Chinese translations of malicious content bypassed all detection

---

为 prompt-injection 和 stealth-instructions 规则添加中文模式检测

**变更：**
- prompt-injection 规则新增 11 条中文正则匹配（高风险）
- stealth-instructions 规则新增 6 条中文匹配 + 1 条安全排除（中风险）
- 修复多语言绕过漏洞：中文翻译的恶意内容可完全绕过检测
