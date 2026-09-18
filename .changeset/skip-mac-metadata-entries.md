---
'reskill': patch
---

Skip macOS metadata entries (`._*`, `__MACOSX/`, `.DS_Store`) when extracting registry tarballs and when detecting the skill root directory. A leading `._<skill>` AppleDouble file (packed by macOS tar) was previously mistaken for the skill directory, causing installs to fail with ENOTDIR. The extractor now prefers the top-level directory that actually contains a SKILL.md, and `reskill publish` also filters these files from newly created tarballs. Fixes #3062
