# reskill CLI Specification

> This document defines the expected behavior of all CLI commands.
> All command changes should start by modifying this spec first.

## Overview

| Command | Alias | Description |
|---------|-------|-------------|
| [init](#init) | - | Initialize skills.json configuration |
| [install](#install) | `i` | Install skills |
| [uninstall](#uninstall) | `un`, `remove`, `rm` | Remove installed skills |
| [list](#list) | `ls` | List installed skills |
| [info](#info) | - | Show skill information |
| [update](#update) | `up` | Update skills to latest version |
| [outdated](#outdated) | - | Check for outdated skills |
| [completion](#completion) | - | Setup shell completion |

---

## init

Initialize a new `skills.json` configuration file.

### Synopsis

```
reskill init [options]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-d, --install-dir <dir>` | `.skills` | Skills installation directory |
| `-y, --yes` | `false` | Skip prompts and use defaults |

### Behavior

| Scenario | Expected Behavior | Exit Code |
|----------|-------------------|-----------|
| `skills.json` does not exist | Create new `skills.json` with defaults | `0` |
| `skills.json` already exists | Print warning, do nothing | `0` |

### Output

**Success:**
```
✓ Created skills.json

Configuration:
  Install directory: .skills

Next steps:
  reskill install <skill>  Install a skill
  reskill list             List installed skills
```

**Already exists:**
```
⚠ skills.json already exists
```

---

## install

Install a skill or reinstall all skills from `skills.json`.

### Synopsis

```
reskill install [skill] [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `skill` | No | Skill reference (e.g., `github:user/skill@v1.0.0`) |

When `skill` is omitted, reinstalls all skills from `skills.json`.

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-f, --force` | `false` | Force reinstall even if already installed |
| `-g, --global` | `false` | Install globally to user home directory |
| `--no-save` | `false` | Do not save to `skills.json` |
| `-a, --agent <agents...>` | auto-detect | Specify target agents |
| `--mode <mode>` | `symlink` | Installation mode: `symlink` or `copy` |
| `-y, --yes` | `false` | Skip confirmation prompts |
| `--all` | `false` | Install to all agents (implies `-y -g`) |

### Agent Resolution Priority

1. `--all` flag → install to all known agents
2. `-a, --agent` flag → use specified agents
3. Reinstall all (no skill arg) + stored agents → use saved `targetAgents`
4. Auto-detect installed agents → prompt if multiple

### Install Mode Resolution Priority

1. `--mode` CLI option
2. Reinstall all + stored mode → use saved `installMode`
3. `-y` flag → default to `symlink`
4. Interactive prompt

### Behavior

| Scenario | Expected Behavior | Exit Code |
|----------|-------------------|-----------|
| Install single skill | Fetch, cache, install to agents, save to `skills.json` | `0` |
| Reinstall all (no arg) | Reinstall all skills from `skills.json` | `0` |
| `skills.json` not found (reinstall) | Error: "Run 'reskill init' first" | `1` |
| No skills in `skills.json` | Info message, done | `0` |
| Invalid agent name | Error with valid agent list | `1` |
| Reinstall all + `--global` | Error: Cannot install all globally | `1` |

### Skill Reference Formats

```
# GitHub shorthand
github:user/repo
github:user/repo@v1.0.0

# GitLab shorthand
gitlab:user/repo
gitlab:user/repo@v1.0.0

# Custom registry (self-hosted GitLab, etc.)
gitlab.company.com:team/skill@v1.0.0

# Git URL (SSH)
git@github.com:user/repo.git
git@gitlab.company.com:team/repo.git

# Git URL (HTTPS)
https://github.com/user/repo.git
https://gitlab.com/user/repo.git

# GitHub/GitLab web URL (with branch and subpath)
https://github.com/user/repo/tree/main/skills/my-skill
```

### Version Formats

| Format | Example | Description |
|--------|---------|-------------|
| Exact | `@v1.0.0` | Lock to specific tag |
| Latest | `@latest` | Get the latest tag |
| Range | `@^2.0.0` | Semver compatible (>=2.0.0 <3.0.0) |
| Branch | `@branch:develop` | Specific branch |
| Commit | `@commit:abc1234` | Specific commit hash |
| (none) | - | Default branch (main) |

---

## uninstall

Remove installed skills.

### Synopsis

```
reskill uninstall <skill> [options]
reskill un <skill> [options]
reskill remove <skill> [options]
reskill rm <skill> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `skill` | Yes | Name of skill to uninstall |

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-g, --global` | `false` | Uninstall from global installation (`~/.cursor/skills/`) |
| `-y, --yes` | `false` | Skip confirmation prompts |

### Behavior

| Scenario | Expected Behavior | Exit Code |
|----------|-------------------|-----------|
| Skill exists in agent dirs | Show summary, confirm, remove from all agents, update `skills.json` | `0` |
| Skill not installed | Warning: "Skill is not installed", done | `0` |
| User cancels prompt | Cancelled, no changes | `0` |
| Uninstall fails | Error message | `1` |

### Notes

- Uninstall checks all agent directories (`.cursor/skills/`, `.claude/skills/`, etc.)
- Removes both the skill directory and symlinks pointing to it
- Updates `skills.json` to remove the skill reference (project mode only)

---

## list

List installed skills.

### Synopsis

```
reskill list [options]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-j, --json` | `false` | Output as JSON |
| `-g, --global` | `false` | List globally installed skills |

### Behavior

| Scenario | Expected Behavior | Exit Code |
|----------|-------------------|-----------|
| Skills exist | Display table with Name, Version, Source | `0` |
| No skills | Info: "No skills installed" | `0` |
| `--json` | Output JSON array | `0` |

### Output

**Table format:**
```
Installed Skills (.skills):

Name          Version       Source
───────────────────────────────────────
my-skill      1.0.0        github:user/repo
other-skill   2.1.0 (linked) github:other/skill

Total: 2 skill(s)
```

**JSON format (`--json`):**

Returns an array of `InstalledSkill` objects scanned from the install directory:

```json
[
  {
    "name": "my-skill",
    "path": ".skills/my-skill",
    "version": "1.0.0",
    "source": "github:user/repo",
    "isLinked": false
  }
]
```

> Note: This is runtime data from scanning `.skills/`, not the `skills.json` config file.

---

## info

Show detailed information about a skill.

### Synopsis

```
reskill info <skill> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `skill` | Yes | Skill name |

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-j, --json` | `false` | Output as JSON |

### Behavior

| Scenario | Expected Behavior | Exit Code |
|----------|-------------------|-----------|
| Skill installed | Show config, lock, and installed info | `0` |
| Skill in config but not installed | Show config and lock info, warn not installed | `0` |
| Skill not found anywhere | Error: "Skill not found" | `1` |
| `--json` | Output full info object as JSON | `0` |

### Output

**Installed skill:**
```
Skill: my-skill

Configuration (skills.json):
  Reference: github:user/repo@v1.0.0

Locked Version (skills.lock):
  Version: 1.0.0
  Source: github:user/repo
  Commit: abc1234
  Installed: 2026-01-23T10:00:00Z

Installed:
  Path: .skills/my-skill
  Version: 1.0.0
  Linked: Yes

Metadata (skill.json):
  Description: A helpful skill
  Author: user
  License: MIT
  Keywords: ai, coding
```

---

## update

Update skills to latest version.

### Synopsis

```
reskill update [skill]
reskill up [skill]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `skill` | No | Specific skill to update (updates all if omitted) |

### Options

*No additional options currently supported.*

### Behavior

| Scenario | Expected Behavior | Exit Code |
|----------|-------------------|-----------|
| `skills.json` not found | Error: "Run 'reskill init' first" | `1` |
| Updates available | Fetch latest, update skills | `0` |
| No skills to update | Info: "No skills to update" | `0` |
| Update fails | Error message | `1` |

### Output

**Success:**
```
✓ Updated 2 skill(s):
  - skill-a@1.2.0
  - skill-b@2.0.0
```

---

## outdated

Check for outdated skills.

### Synopsis

```
reskill outdated [options]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-j, --json` | `false` | Output as JSON |

### Behavior

| Scenario | Expected Behavior | Exit Code |
|----------|-------------------|-----------|
| `skills.json` not found | Error: "Run 'reskill init' first" | `1` |
| No skills defined | Info: "No skills defined in skills.json" | `0` |
| Outdated skills exist | Show table with Current vs Latest | `0` |
| All up-to-date | Success: "All skills are up to date!" | `0` |
| Check fails | Error message | `1` |

### Output

**Table format:**
```
Skill         Current    Latest     Status
───────────────────────────────────────────────────
my-skill      1.0.0      1.2.0      ⬆️ Update available
other-skill   2.0.0      2.0.0      ✅ Up to date

Run 'reskill update' to update all skills
Or 'reskill update <skill>' to update a specific skill
```

**JSON format (`--json`):**
```json
[
  {
    "name": "my-skill",
    "current": "1.0.0",
    "latest": "1.2.0",
    "updateAvailable": true
  }
]
```

---

## completion

Setup shell completion for reskill using tabtab.

### Synopsis

```
reskill completion [action]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `action` | No | Action: `install` or `uninstall` |

### Behavior

| Scenario | Expected Behavior | Exit Code |
|----------|-------------------|-----------|
| No action | Show usage help | `0` |
| `install` | Install completion to shell config | `0` |
| `uninstall` | Remove completion from shell config | `0` |
| Unknown action | Error: "Unknown action" | `1` |

### Output

**No action (help):**
```
Shell completion for reskill

Usage:
  reskill completion install     Install completion (interactive)
  reskill completion uninstall   Remove completion

Supported shells: bash, zsh, fish

After installation, restart your shell or run:
  source ~/.bashrc   # for bash
  source ~/.zshrc    # for zsh
```

**Install success:**
```
✓ Completion installed successfully!
Restart your shell or source your shell config file.
```

### Completion Features

Once installed, provides completion for:
- Subcommands (`reskill <TAB>`)
- Skill names for `info`, `uninstall`, `update` commands
- Agent names after `-a`/`--agent` flag
- Options when typing `-` or `--`

---

## Global Options

These options are available for all commands:

| Option | Description |
|--------|-------------|
| `-h, --help` | Display help for command |
| `-V, --version` | Display version number |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error (invalid input, operation failed) |
| `130` | Cancelled by user (Ctrl+C) |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DEBUG` | Enable debug logging when set |
| `NO_COLOR` | Disable colored output |
| `RESKILL_CACHE_DIR` | Custom cache directory (default: `~/.reskill-cache`) |

---

## Configuration Files

### skills.json

```json
{
  "$schema": "https://reskill.dev/schema/skills.json",
  "skills": {
    "skill-name": "github:user/repo@v1.0.0",
    "private-skill": "internal:team/skill@latest"
  },
  "registries": {
    "internal": "https://gitlab.company.com",
    "private": "git@gitlab.internal.io"
  },
  "defaults": {
    "installDir": ".skills",
    "targetAgents": ["cursor", "claude-code"],
    "installMode": "symlink"
  }
}
```

### skills.lock

```json
{
  "lockfileVersion": 1,
  "skills": {
    "skill-name": {
      "version": "1.0.0",
      "resolved": "github:user/repo",
      "integrity": "sha256-..."
    }
  }
}
```

---

## Changelog

Track specification changes here:

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-23 | 0.1.2 | Added version formats and registry support documentation |
| 2026-01-23 | 0.1.1 | Fixed spec to match actual implementation |
| 2026-01-23 | 0.1.0 | Initial specification |

### 0.1.2 Additions

- Added Version Formats table (`@branch:`, `@commit:`, `@^x.y.z`, etc.)
- Added GitLab and custom registry support to Skill Reference Formats
- Added GitHub/GitLab web URL format support

### 0.1.1 Fixes

- `uninstall`: Added aliases `un`, `remove`, `rm`
- `uninstall`: Fixed behavior - returns exit 0 when skill not installed (warning only)
- `update`: Added alias `up`, removed non-existent `-g` and `-y` options
- `outdated`: Removed non-existent `-g` option, added `skills.json` requirement
- `completion`: Changed from shell name to action-based (`install`/`uninstall`)
- `info`: Updated output format to match actual implementation
