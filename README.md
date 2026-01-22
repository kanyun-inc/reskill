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
# 1. Initialize project
npx reskill@latest init

# 2. Install a skill
npx reskill@latest install github:anthropics/skills/frontend-design@latest

# 3. List installed skills
npx reskill@latest list
```

## What is reskill?

reskill is a **Git-based package manager** for AI agent skills, similar to npm or Go modules. It provides declarative configuration, version locking, and seamless synchronization for managing skills across projects and teams.

**Supports:** Cursor, Claude Code, Codex, OpenCode, Windsurf, GitHub Copilot, and more.

## Why reskill?

reskill offers **fine-grained skill management and synchronization**:

### Local Experience

- **Declarative config** — `skills.json` clearly expresses project dependencies
- **Global cache** — Avoid redundant downloads, speed up installation

### Engineering-Grade Management

- **Version locking** — `skills.lock` ensures team consistency
- **Flexible versioning** — Support exact versions, semver ranges, branches, and commits
- **Git as Registry** — No additional services needed, any Git repo is a skill source

### Cross-Project Sync

- **Version controlled** — Commit `skills.json` and `skills.lock` to your repo
- **CI integration** — Run `reskill install` in CI to verify dependencies
- **Multi-registry** — Support GitHub, GitLab, and private repositories

### Flexible Version Strategy

```json
{
  "skills": {
    "frontend-design": "github:anthropics/skills/frontend-design@latest",
    "code-review": "github:team/code-review@v2.1.0",
    "testing": "github:team/testing@^1.0.0"
  }
}
```

When running `reskill update`:
- `@latest` skills automatically update to the newest tag
- `@v2.1.0` stays locked
- `@^1.0.0` updates to the latest 1.x.x version

## Installation

```bash
# Global install (recommended for regular use)
npm install -g reskill

# Or use npx with @latest (recommended for ongoing skill management)
npx reskill@latest <command>

# For one-time use, npx reskill also works
npx reskill <command>
```

> **Note:** When using `npx`, we recommend `npx reskill@latest` to ensure you always get the latest version. Without `@latest`, npx may use a cached older version.

## Usage

### Source Formats

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

### Version Specification

| Format | Example | Description |
|--------|---------|-------------|
| Exact | `@v1.0.0` | Lock to specific tag |
| Latest | `@latest` | Get the latest tag |
| Range | `@^2.0.0` | Semver compatible (>=2.0.0 <3.0.0) |
| Branch | `@branch:develop` | Specific branch |
| Commit | `@commit:abc1234` | Specific commit hash |

## Commands

You can use `npx reskill@latest` directly without global installation:

```bash
# Initialize project
npx reskill@latest init

# Install a skill from GitHub
npx reskill@latest install github:anthropics/skills/frontend-design@latest

# Install from private GitLab
npx reskill@latest install gitlab.company.com:team/internal-skill@v1.0.0

# List installed skills
npx reskill@latest list
```

### Command Reference

| Command | Description |
|---------|-------------|
| `npx reskill@latest init` | Initialize `skills.json` in current directory |
| `npx reskill@latest install [skill]` | Install skills from `skills.json` or a specific skill |
| `npx reskill@latest list` | List installed skills |
| `npx reskill@latest info <skill>` | Show skill details |
| `npx reskill@latest update [skill]` | Update all or specific skill |
| `npx reskill@latest outdated` | Check for outdated skills |
| `npx reskill@latest uninstall <skill>` | Remove a skill |
| `npx reskill@latest completion install` | Install shell tab completion |

Run `npx reskill@latest <command> --help` for detailed options.

### Shell Completion

reskill supports tab completion for bash, zsh, and fish shells.

```bash
# Install completion (interactive, one-time setup)
reskill completion install

# Then restart your shell or run:
source ~/.zshrc   # for zsh
source ~/.bashrc  # for bash
```

After installation, you can use tab completion:

```bash
reskill <Tab>              # Show all commands
reskill info <Tab>         # Complete installed skill names
reskill uninstall <Tab>    # Complete installed skill names
reskill install -<Tab>     # Complete options (-f, -g, -a, etc.)
reskill install -a <Tab>   # Complete agent names
```

To remove completion: `reskill completion uninstall`

## Private GitLab Support

reskill fully supports private GitLab repositories, including self-hosted instances. Authentication is handled transparently through your system's git configuration.

### Authentication Methods

**SSH (Recommended)**

reskill uses your existing SSH configuration automatically:

```bash
# Uses your ~/.ssh/id_rsa or ~/.ssh/id_ed25519 automatically
npx reskill@latest install gitlab.company.com:team/private-skill@v1.0.0

# Or with explicit SSH URL
npx reskill@latest install git@gitlab.company.com:team/private-skill.git@v1.0.0
```

Ensure your SSH key is added to GitLab and ssh-agent is running.

**HTTPS with Git Credential**

For CI/CD or environments without SSH, configure git credential helper:

```bash
# Store credentials (will prompt once, then remember)
git config --global credential.helper store

# Or use environment variable in CI
git config --global credential.helper '!f() { echo "username=oauth2"; echo "password=${GITLAB_TOKEN}"; }; f'
```

For GitLab CI/CD, use the built-in `CI_JOB_TOKEN`:

```yaml
before_script:
  - git config --global url."https://gitlab-ci-token:${CI_JOB_TOKEN}@gitlab.company.com/".insteadOf "https://gitlab.company.com/"
```

### Registry Configuration

Configure private registries in `skills.json`:

```json
{
  "registries": {
    "internal": "https://gitlab.company.com",
    "private": "git@gitlab.internal.io"
  },
  "skills": {
    "company-standards": "internal:team/standards@latest",
    "private-utils": "private:utils/helpers@v1.0.0"
  }
}
```

### Self-Hosted GitLab

For self-hosted GitLab instances with custom domains:

```bash
# Direct installation
npx reskill@latest install git.mycompany.io:team/skill@v1.0.0

# With explicit SSH URL
npx reskill@latest install git@git.mycompany.io:team/skill.git@v1.0.0
```

## Configuration

### skills.json

```json
{
  "name": "my-project",
  "skills": {
    "planning": "github:user/planning-skill@v1.0.0",
    "code-review": "gitlab:team/code-review@latest"
  },
  "defaults": {
    "registry": "github",
    "installDir": ".skills"
  },
  "registries": {
    "internal": "https://gitlab.company.com"
  }
}
```

### skills.lock

The lock file records exact versions and commit hashes to ensure reproducible installations across your team.

## Multi-Agent Support

reskill works with all major AI coding agents. Skills are installed to the `.skills/` directory by default and can be integrated with any agent.

| Agent | Integration Path |
|-------|------------------|
| Cursor | `.cursor/rules/` or `.cursor/skills/` |
| Claude Code | `.claude/skills/` |
| Codex | `.codex/skills/` |
| OpenCode | `.opencode/skills/` |
| Windsurf | `.windsurf/skills/` |
| GitHub Copilot | `.github/skills/` |

## Skill Repository Structure

Each skill repository should follow this structure:

```
my-skill/
├── skill.json           # Metadata (required)
├── SKILL.md             # Main entry document (required)
├── README.md            # Repository description
└── templates/           # Template files (optional)
```

### skill.json

```json
{
  "name": "my-skill",
  "version": "1.0.0",
  "description": "A skill for ...",
  "author": "Your Name",
  "license": "MIT",
  "entry": "SKILL.md",
  "keywords": ["ai", "skill"]
}
```

## Project Structure

After installation:

```
my-project/
├── skills.json          # Dependency declaration
├── skills.lock          # Version lock file
└── .skills/             # Installation directory
    ├── planning/
    │   ├── skill.json
    │   └── SKILL.md
    └── code-review/
        ├── skill.json
        └── SKILL.md
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RESKILL_CACHE_DIR` | Global cache directory | `~/.reskill-cache` |
| `DEBUG` | Enable debug logging | - |

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

Thanks to these projects for pioneering the AI agent skills ecosystem!

## Related Links

- [Agent Skills Specification](https://agentskills.io)

## License

MIT
