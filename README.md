<div align="center">

<img src="https://raw.githubusercontent.com/kanyun-ai-infra/reskill/main/logov2.png" alt="reskill" height="48" />

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
npx reskill@latest install github:anthropics/skills/skills/frontend-design@latest
npx reskill@latest list
```

## Features

- **One-click install** — Install any skill from any Git repo with a single command
- **Declarative config** — `skills.json` + `skills.lock` for team consistency
- **Flexible versioning** — Exact versions, semver ranges, branches, commits
- **Multi-source** — GitHub, GitLab, self-hosted repos, HTTP/OSS archives
- **Multi-agent** — Cursor, Claude Code, Codex, Windsurf, GitHub Copilot, and more
- **Registry support** — Publish and share skills via registry

## Installation

**Requirements:** Node.js >= 18.0.0

```bash
npm install -g reskill        # Global install
npx reskill@latest <command>  # Or use npx directly
```

## Commands

| Command               | Alias                | Description                               |
| --------------------- | -------------------- | ----------------------------------------- |
| `init`                | -                    | Initialize `skills.json`                  |
| `find <query>`        | `search`             | Search for skills in the registry         |
| `install [skills...]` | `i`                  | Install one or more skills                |
| `list`                | `ls`                 | List installed skills                     |
| `info <skill>`        | -                    | Show skill details                        |
| `update [skill]`      | `up`                 | Update skills                             |
| `outdated`            | -                    | Check for outdated skills                 |
| `uninstall <skill>`   | `un`, `rm`, `remove` | Remove a skill                            |
| `group`               | -                    | Manage skill groups ¹                     |
| `publish [path]`      | `pub`                | Publish a skill to the registry ¹         |
| `login`               | -                    | Authenticate with the registry ¹          |
| `logout`              | -                    | Remove stored authentication ¹            |
| `whoami`              | -                    | Display current logged in user ¹          |
| `doctor`              | -                    | Diagnose environment and check for issues |
| `completion [action]` | -                    | Setup or remove shell tab completion      |

> ¹ Registry commands (`group`, `publish`, `login`, `logout`, `whoami`) require a private registry deployment. Not available for public use yet.

### Common Options

| Option                    | Commands                                                      | Description                                                   |
| ------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| `--no-save`               | `install`                                                     | Install without saving to `skills.json` (for personal skills) |
| `-g, --global`            | `install`, `uninstall`, `list`                                | Install/manage skills globally (user directory)               |
| `-a, --agent <agents...>` | `install`                                                     | Specify target agents (e.g., `cursor`, `claude-code`)         |
| `--mode <mode>`           | `install`                                                     | Installation mode: `symlink` (default) or `copy`              |
| `--all`                   | `install`                                                     | Install to all agents                                          |
| `-y, --yes`               | `install`, `uninstall`, `publish`                             | Skip confirmation prompts                                      |
| `-f, --force`             | `install`                                                     | Force reinstall even if already installed                      |
| `-s, --skill <names...>`  | `install`                                                     | Select specific skill(s) by name from a multi-skill repo      |
| `--list`                  | `install`                                                     | List available skills in the repository without installing     |
| `-t, --token <token>`     | `install`, `find`, `group`, `publish`, `login`                | Auth token for registry API requests (for CI/CD)               |
| `-r, --registry <url>`    | `install`, `find`, `group`, `publish`, `login`, `logout`, `whoami` | Registry URL override for registry-enabled commands       |
| `-j, --json`              | `list`, `info`, `outdated`, `doctor`, `group`, `find`         | Output as JSON                                                 |
| `-l, --limit <n>`         | `find`                                                        | Maximum number of search results                               |
| `--skip-network`          | `doctor`                                                      | Skip network connectivity checks                              |

Run `reskill <command> --help` for complete options and detailed usage.

### Group Command Quick Reference

```bash
# List groups
reskill group list
reskill group list --tree

# Create / inspect / delete groups
reskill group create "Frontend Team" --description "Frontend skills"
reskill group info kanyun/frontend
reskill group delete kanyun/frontend --dry-run
reskill group delete kanyun/frontend -y

# Manage members
reskill group member list kanyun/frontend
reskill group member add kanyun/frontend alice bob --role developer
reskill group member remove kanyun/frontend alice
reskill group member role kanyun/frontend bob maintainer
```

`publish --group <path>` normalizes and validates the path before request.  
For full group path rules, see [CLI Specification - group](./docs/cli-spec.md#group).

## Source Formats

```bash
# GitHub shorthand
npx reskill@latest install github:user/skill@v1.0.0

# GitLab shorthand
npx reskill@latest install gitlab:group/skill@latest

# Full Git URL (HTTPS)
npx reskill@latest install https://github.com/user/skill.git

# Full Git URL (SSH)
npx reskill@latest install git@github.com:user/skill.git

# GitHub/GitLab web URL (with branch and subpath)
npx reskill@latest install https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines

# Custom registry (self-hosted GitLab, etc.)
npx reskill@latest install gitlab.company.com:team/skill@v1.0.0

# HTTP/OSS archives
npx reskill@latest install https://example.com/skills/my-skill-v1.0.0.tar.gz
npx reskill@latest install oss://bucket/path/skill.tar.gz
npx reskill@latest install s3://bucket/path/skill.zip

# Registry-based (requires registry deployment)
npx reskill@latest install @scope/skill-name@1.0.0
npx reskill@latest install skill-name

# Install multiple skills at once
npx reskill@latest install github:user/skill1 github:user/skill2@v1.0.0
```

### Monorepo Support

For repositories containing multiple skills (monorepo), you can install a specific skill by path or install all skills from a parent directory:

```bash
# Shorthand format with subpath
npx reskill@latest install github:org/monorepo/skills/planning@v1.0.0
npx reskill@latest install gitlab:company/skills/frontend/components@latest

# URL format with subpath
npx reskill@latest install https://github.com/org/monorepo.git/skills/planning@v1.0.0
npx reskill@latest install git@gitlab.company.com:team/skills.git/backend/apis@v2.0.0

# GitHub web URL automatically extracts subpath
npx reskill@latest install https://github.com/org/monorepo/tree/main/skills/planning

# Point to a parent directory — auto-detects and installs all child skills
npx reskill@latest install https://github.com/org/monorepo/tree/main/skills
```

When the target directory has no root `SKILL.md` but contains subdirectories with `SKILL.md` files, reskill automatically discovers and installs all child skills. Each skill is saved separately in `skills.json`.

### HTTP/OSS URL Support

Skills can be installed directly from HTTP/HTTPS URLs pointing to archive files:

| Format       | Example                                                    | Description              |
| ------------ | ---------------------------------------------------------- | ------------------------ |
| HTTPS URL    | `https://example.com/skill.tar.gz`                         | Direct download URL      |
| Aliyun OSS   | `https://bucket.oss-cn-hangzhou.aliyuncs.com/skill.tar.gz` | Aliyun OSS URL           |
| AWS S3       | `https://bucket.s3.amazonaws.com/skill.tar.gz`             | AWS S3 URL               |
| OSS Protocol | `oss://bucket/path/skill.tar.gz`                           | Shorthand for Aliyun OSS |
| S3 Protocol  | `s3://bucket/path/skill.tar.gz`                            | Shorthand for AWS S3     |

**Supported archive formats:** `.tar.gz`, `.tgz`, `.zip`, `.tar`

## Version Specification

| Format | Example           | Description                        |
| ------ | ----------------- | ---------------------------------- |
| Exact  | `@v1.0.0`         | Lock to specific tag               |
| Latest | `@latest`         | Get the latest tag                 |
| Range  | `@^2.0.0`         | Semver compatible (>=2.0.0 <3.0.0) |
| Branch | `@branch:develop` | Specific branch                    |
| Commit | `@commit:abc1234` | Specific commit hash               |
| (none) | -                 | Default branch (main)              |

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
    "installDir": ".skills",
    "targetAgents": ["cursor", "claude-code"],
    "installMode": "symlink"
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

| Agent          | Path               |
| -------------- | ------------------ |
| Amp            | `.agents/skills`   |
| Antigravity    | `.agent/skills`    |
| Claude Code    | `.claude/skills`   |
| Clawdbot       | `skills`           |
| Codex          | `.codex/skills`    |
| Cursor         | `.cursor/skills`   |
| Droid          | `.factory/skills`  |
| Gemini CLI     | `.gemini/skills`   |
| GitHub Copilot | `.github/skills`   |
| Goose          | `.goose/skills`    |
| Kilo Code      | `.kilocode/skills` |
| Kiro CLI       | `.kiro/skills`     |
| Neovate        | `.neovate/skills`  |
| OpenCode       | `.opencode/skills` |
| Roo Code       | `.roo/skills`      |
| Trae           | `.trae/skills`     |
| Windsurf       | `.windsurf/skills` |

## Publishing Skills

> **Note:** Publishing requires a private registry deployment. This feature is not available for public use yet.

Publish your skills to the registry for others to use:

```bash
# Group management examples
reskill group list
reskill group list --tree
reskill group create "Frontend Team" --description "Frontend skills"
reskill group info kanyun/frontend
reskill group member add kanyun/frontend alice bob --role developer

# Interactive login (recommended for humans — guides you through token setup)
reskill login

# Non-interactive login (for CI/CD — pass token directly)
reskill login --token <your-token>

# Validate without publishing (dry run)
reskill publish --dry-run

# Validate publish with target group
reskill publish --dry-run --group kanyun/frontend

# Publish the skill
reskill publish
```

For detailed publishing guidelines, see the [CLI Specification](./docs/cli-spec.md#publish).

### Installing Private Skills

After logging in with `reskill login`, the token stored in `~/.reskillrc` is automatically used during `reskill install` to access private skills:

```bash
# Token is automatically read from ~/.reskillrc (requires --registry to match)
reskill install @scope/private-skill --registry https://your-registry.com

# Or use RESKILL_TOKEN env var (works without --registry)
RESKILL_TOKEN=<token> reskill install @scope/private-skill

# Or pass token directly (for CI/CD)
reskill install @scope/private-skill --registry https://your-registry.com --token <token>
```

## Environment Variables

| Variable            | Description                                     | Default                        |
| ------------------- | ----------------------------------------------- | ------------------------------ |
| `RESKILL_CACHE_DIR` | Global cache directory                          | `~/.reskill-cache`             |
| `RESKILL_TOKEN`     | Auth token (takes precedence over ~/.reskillrc) | -                              |
| `RESKILL_REGISTRY`  | Default registry URL                            | `https://registry.reskill.dev` |
| `DEBUG`             | Enable debug logging                            | -                              |
| `VERBOSE`           | Enable debug logging (same effect as `DEBUG`)   | -                              |
| `NO_COLOR`          | Disable colored output                          | -                              |

reskill checks for newer versions in the background and shows an upgrade tip after command execution.

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

# Run integration tests
pnpm test:integration

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
