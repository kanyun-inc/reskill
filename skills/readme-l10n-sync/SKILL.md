---
name: readme-l10n-sync
description: Keeps README localization files synchronized with README.md using a language-agnostic workflow.
version: 0.1.0
---

# README L10n Sync

Use this skill when `README.md` changes and localized README files need to stay aligned.

## Scope

- Source file: `README.md`
- Target files: `README.*.md` in project root (excluding `README.md`)
- Current examples: `README.zh-CN.md`
- Future-ready: automatically covers files like `README.ja.md`, `README.es.md`

## Workflow

Follow this sequence strictly:

1. Detect whether `README.md` changed.
2. Discover all localized README targets (`README.*.md`).
3. Compare source updates against each target and sync meaningful changes.
4. Output a per-file status report: `updated`, `already-in-sync`, or `skipped-with-reason`.
5. If any target is skipped, explicitly ask for confirmation before finalizing.

## Sync Rules

Sync required changes:

- Commands, flags, defaults, examples, paths, and behavioral descriptions
- Newly added sections that affect usage
- Removed/deprecated features that should no longer be documented

Allowed to differ:

- Language-specific wording and tone
- Section ordering when readability in the target language requires it

## Reporting Format

Use this summary format:

```text
README Sync Report
Source: README.md
Targets: README.zh-CN.md, README.ja.md

- README.zh-CN.md: updated (commands table + install examples)
- README.ja.md: skipped (file does not exist yet)

Action needed: Confirm whether skipped targets are intentional.
```

## Marker Convention

Add markers to each localized README:

```markdown
<!-- source: README.md -->
<!-- synced: YYYY-MM-DD -->
```

Update `synced` to today's date whenever the localized file is intentionally refreshed.
