---
'reskill': patch
---

Skip macOS metadata entries (`._*`, `__MACOSX/`, `.DS_Store`) when extracting registry tarballs and when detecting the skill root directory. A leading `._<skill>` AppleDouble file (packed by macOS tar) was previously mistaken for the skill directory, causing installs to fail with ENOTDIR. The extractor now prefers the top-level directory that actually contains a SKILL.md (warning if several do), `reskill publish` filters these files from tarballs, file scanning/integrity hashing use the same filtered set, and installing a tarball with no SKILL.md at all now fails with a clear error instead of silently installing an empty skill. Fixes #3062
