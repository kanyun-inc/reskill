<div align="center">

# reskill

**Git-based Skills Package Manager for AI Agents**

*Declarative skill management like npm/Go modules — install, version, sync, and share AI agent skills*

[![npm version](https://img.shields.io/npm/v/reskill.svg)](https://www.npmjs.com/package/reskill)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

English | [简体中文](./README.zh-CN.md)

</div>

---

## Quick Start

```bash
npx reskill@latest init
npx reskill@latest install github:anthropics/skills/frontend-design@latest
npx reskill@latest list
```

## Features

- **One-click install** — Install any skill from any Git repo with a single command
- **Declarative config** — `skills.json` + `skills.lock` for team consistency
- **Flexible versioning** — Exact versions, semver ranges, branches, commits
- **Multi-registry** — GitHub, GitLab, self-hosted, private repos
- **Multi-agent** — Cursor, Claude Code, Codex, Windsurf, GitHub Copilot, and more

## Installation

```bash
npm install -g reskill        # Global install
npx reskill@latest <command>  # Or use npx directly
```

## Commands

| Command              | Description                               |
| -------------------- | ----------------------------------------- |
| `init`               | Initialize `skills.json`                  |
| `install [skill]`    | Install skills                            |
| `list`               | List installed skills                     |
| `info <skill>`       | Show skill details                        |
| `update [skill]`     | Update skills                             |
| `outdated`           | Check for outdated skills                 |
| `uninstall <skill>`  | Remove a skill                            |
| `doctor`             | Diagnose environment and check for issues |
| `completion install` | Install shell tab completion              |

Run `reskill <command> --help` for detailed options.

## Source Formats

```bash
# GitHub shorthand
npx reskill@latest install github:user/skill@v1.0.0

# Full Git URL
npx reskill@latest install https://github.com/user/skill.git

# GitHub web URL (with branch and subpath)
npx reskill@latest install https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines

# GitLab
npx reskill@latest install gitlab:group/skill@latest

# Private registry
npx reskill@latest install gitlab.company.com:team/skill@v1.0.0

# Default registry (from skills.json)
npx reskill@latest install user/skill@v1.0.0
```

## Version Specification

| Format | Example           | Description          |
| ------ | ----------------- | -------------------- |
| Exact  | `@v1.0.0`         | Lock to specific tag |
| Latest | `@latest`         | Get the latest tag   |
| Range  | `@^2.0.0`         | Semver compatible    |
| Branch | `@branch:develop` | Specific branch      |
| Commit | `@commit:abc1234` | Specific commit hash |

## Configuration

### skills.json

```json
{
  "skills": {
    "planning": "github:user/planning-skill@v1.0.0",
    "internal-tool": "internal:team/tool@latest"
  },
  "registries": {
    "internal": "https://gitlab.company.com"
  },
  "defaults": {
    "installDir": ".skills"
  }
}
```

### Private Repositories

reskill uses your existing git credentials (SSH keys or credential helper). For CI/CD:

```bash
# GitLab CI
git config --global url."https://gitlab-ci-token:${CI_JOB_TOKEN}@gitlab.company.com/".insteadOf "https://gitlab.company.com/"
```

## Multi-Agent Support

Skills are installed to `.skills/` by default and can be integrated with any agent:

| Agent          | Path                                  |
| -------------- | ------------------------------------- |
| Cursor         | `.cursor/rules/` or `.cursor/skills/` |
| Claude Code    | `.claude/skills/`                     |
| Codex          | `.codex/skills/`                      |
| Windsurf       | `.windsurf/skills/`                   |
| GitHub Copilot | `.github/skills/`                     |

## Environment Variables

| Variable            | Description            | Default            |
| ------------------- | ---------------------- | ------------------ |
| `RESKILL_CACHE_DIR` | Global cache directory | `~/.reskill-cache` |
| `DEBUG`             | Enable debug logging   | -                  |

## Development

```bash
# Install dependencies
pnpm install

# Development mode
pnpm dev

# Build
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

## Acknowledgements

reskill was inspired by and references the implementations of these excellent projects:

- [add-skill](https://github.com/vercel-labs/add-skill) by Vercel Labs
- [skild](https://github.com/Peiiii/skild) by Peiiii
- [openskills](https://github.com/numman-ali/openskills) by Numman Ali

## Related Links

- [Agent Skills Specification](https://agentskills.io)

## License

MIT
