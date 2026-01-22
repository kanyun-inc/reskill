/install-github-app# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

reskill is a Git-based package manager for AI agent skills, similar to npm/Go modules. It provides declarative configuration (`skills.json`), version locking (`skills.lock`), and seamless synchronization for managing skills across projects and teams.

**Supported Agents:** Cursor, Claude Code, Codex, OpenCode, Windsurf, GitHub Copilot, and more.

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Development mode (watch)
pnpm build            # Build with Rslib
pnpm test             # Run tests in watch mode
pnpm test:run         # Run tests once
pnpm test:coverage    # Run tests with coverage
pnpm test:integration # Build and run integration tests
pnpm lint             # Lint with Biome
pnpm lint:fix         # Lint and auto-fix
pnpm typecheck        # TypeScript type checking
```

## Architecture

```
src/
├── cli/              # CLI commands (Commander.js)
│   ├── commands/     # Individual command handlers
│   └── index.ts      # CLI entry point
├── core/             # Core business logic
│   ├── skill-manager.ts    # Main orchestrator
│   ├── git-resolver.ts     # Git URL parsing and version resolution
│   ├── cache-manager.ts    # Global cache (~/.reskill-cache)
│   ├── config-loader.ts    # skills.json handling
│   ├── lock-manager.ts     # skills.lock handling
│   ├── installer.ts        # Multi-agent installation (symlink/copy)
│   ├── agent-registry.ts   # Agent type definitions and paths
│   └── skill-parser.ts     # SKILL.md parsing
├── types/            # TypeScript type definitions
└── utils/            # Shared utilities (fs, git, logger)
```

### Key Module Responsibilities

- **SkillManager**: Main orchestrator integrating all components
- **GitResolver**: Parse skill refs (`github:user/repo@v1.0.0`), resolve versions, build repo URLs
- **CacheManager**: Global cache operations using degit
- **ConfigLoader**: Read/write `skills.json`
- **LockManager**: Read/write `skills.lock` for version locking
- **Installer**: Handle multi-agent installation to paths like `.cursor/skills/`, `.claude/skills/`
- **AgentRegistry**: Define supported agents and their installation paths

## Code Conventions

### Language Requirements
- All comments, variable names, and commit messages in English
- Use `node:` prefix for Node.js built-in imports
- Import order: Node built-ins → External deps → Internal modules

### TypeScript Standards
- Prefer `type` over `interface` for simple type aliases
- Use explicit return types for public functions
- Avoid `any`, use `unknown` with type guards

### File Operations
Use utilities from `src/utils/fs.ts`: `exists`, `readJson`, `writeJson`, `remove`, `ensureDir`, `createSymlink`

### Logging
Use `logger` from `src/utils/logger.ts`: `info`, `success`, `warn`, `error`, `debug`, `package`

## Testing Requirements

### Unit Tests
- Tests use Vitest with `.test.ts` suffix alongside source files
- Use temp directories for file system tests, clean up in `afterEach`
- Mock external dependencies (fs, network)
- **Bug Fix Protocol**: Write a failing test to reproduce the bug before implementing the fix

### Integration Tests
- Integration tests verify the built CLI behavior
- Run with `pnpm test:integration` (builds first, then runs `scripts/integration-test.sh`)
- Tests execute actual CLI commands against a temporary directory
- Use integration tests to verify end-to-end command behavior

```bash
# Run integration tests manually after building
pnpm build
node dist/cli/index.js init -y
node dist/cli/index.js list
```

## Changesets

This project uses Changesets for versioning. After making changes:

```bash
pnpm changeset        # Create changeset (interactive)
```

Changeset files should be bilingual (English + Chinese). Use `pnpm run version` or `pnpm changeset version` (NOT `pnpm version`).

## CLI Command Pattern

```typescript
import { Command } from 'commander';
import { SkillManager } from '../../core/skill-manager.js';
import { logger } from '../../utils/logger.js';

export const myCommand = new Command('my-command')
  .description('Description in English')
  .argument('[arg]', 'Argument description')
  .action(async (arg, options) => {
    const manager = new SkillManager(process.cwd());
    try {
      // Implementation
      logger.success('Operation completed');
    } catch (error) {
      logger.error(`Failed: ${(error as Error).message}`);
      process.exit(1);
    }
  });
```

## Git Commits

Use conventional commits: `type(scope): description`
- Types: feat, fix, docs, style, refactor, test, chore
