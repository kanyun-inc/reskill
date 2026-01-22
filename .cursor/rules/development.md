# reskill Development Rules

## Project Overview

reskill is a Git-based package manager for AI agent skills, similar to npm/Go modules. It provides declarative configuration, version locking, and seamless synchronization for managing skills across projects and teams.

**Supported AI Agents:** Cursor, Claude Code, Codex, OpenCode, Windsurf, GitHub Copilot, and more.

## Tech Stack

- **Language:** TypeScript (ES Modules)
- **Runtime:** Node.js >= 18.0.0
- **Build Tool:** Rslib (Rspack-based library bundler)
- **Testing:** Vitest with @vitest/coverage-v8
- **CLI Framework:** Commander.js
- **Linting/Formatting:** Biome
- **Package Manager:** pnpm

## Code Style Guidelines

### Language Requirements

- **Primary Language:** English
- **Comments:** Must be in English only, no Chinese comments allowed
- **Variable/Function Names:** Use English, camelCase for variables and functions
- **Class Names:** PascalCase
- **File Names:** kebab-case for files, e.g., `skill-manager.ts`

### TypeScript Standards

- Use strict TypeScript configuration
- Prefer `type` over `interface` for simple type aliases
- Use explicit return types for public functions
- Use `readonly` for immutable properties
- Avoid `any` type, use `unknown` with type guards instead

```typescript
// Good
export function parseRef(ref: string): ParsedSkillRef { ... }

// Avoid
export function parseRef(ref: string) { ... }
```

### Import Order

1. Node.js built-in modules (with `node:` prefix)
2. External dependencies
3. Internal modules (relative imports)

```typescript
import * as path from 'node:path';
import * as fs from 'node:fs';

import { Command } from 'commander';
import semver from 'semver';

import { SkillManager } from '../core/skill-manager.js';
import type { InstalledSkill } from '../types/index.js';
```

### Error Handling

- Use descriptive error messages in English
- Throw typed errors when possible
- Log errors with appropriate log levels
- Always clean up resources in error cases

```typescript
// Good
if (!exists(skillPath)) {
  throw new Error(`Skill ${name} not found at ${skillPath}`);
}

// Log for user feedback
logger.error(`Failed to install ${name}: ${error.message}`);
```

## Testing Requirements

### Test Coverage Policy

- **Unit tests are REQUIRED for all new code**
- Tests must be created alongside source files
- Minimum coverage target: 70% for new code
- Test files use `.test.ts` suffix in the same directory as source

### Test File Structure

```
src/core/
├── skill-manager.ts          # Source file
├── skill-manager.test.ts     # Test file (REQUIRED)
├── config-loader.ts
├── config-loader.test.ts     # Test file (REQUIRED)
```

### Test Writing Guidelines

- Use Vitest's describe/it pattern
- Use meaningful test descriptions in English
- Set up and tear down test fixtures properly
- Mock external dependencies (fs, network)
- Use temporary directories for file system tests

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('SkillManager', () => {
  let tempDir: string;
  
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-test-'));
  });
  
  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  
  describe('install', () => {
    it('should install skill to correct directory', async () => {
      // Test implementation
    });
    
    it('should throw error when skill not found', async () => {
      await expect(manager.install('invalid')).rejects.toThrow();
    });
  });
});
```

### Test Categories

1. **Unit Tests** - Test individual functions/classes in isolation
2. **Integration Tests** - Test module interactions (skip network tests with `it.skip`)
3. **Edge Cases** - Test error conditions and boundary values

### Bug Fix Protocol (TDD Approach)

All bug fixes MUST follow this protocol:

1. **Reproduce First** - Write a failing test that reproduces the bug before writing any fix code
2. **Fix the Bug** - Implement the minimal fix to make the test pass
3. **Verify with Test** - Ensure the test passes after the fix
4. **Regression Prevention** - The test serves as a regression guard for future changes

```typescript
// Example: Bug fix test pattern
describe('SkillManager', () => {
  describe('bug fixes', () => {
    it('should list skills from canonical directory (.agents/skills/)', () => {
      // This test was added to reproduce issue #XXX
      // Bug: list() was checking .skills/ instead of .agents/skills/
      
      // Setup: Create skill in canonical location
      // Action: Call list()
      // Assert: Skill should be found
    });
  });
});
```

**Why this matters:**
- Ensures the bug is actually fixed, not just the symptom
- Prevents the same bug from reappearing
- Documents the bug and its fix in code
- Provides confidence when refactoring

## Project Architecture

See `.cursor/ARCHITECTURE.md` for detailed architecture documentation.

### Directory Structure

```
src/
├── cli/              # CLI implementation
│   ├── commands/     # Individual command handlers
│   └── index.ts      # CLI entry point
├── core/             # Core business logic
│   ├── skill-manager.ts    # Main orchestrator
│   ├── git-resolver.ts     # Git URL parsing and resolution
│   ├── cache-manager.ts    # Local caching
│   ├── config-loader.ts    # skills.json handling
│   ├── lock-manager.ts     # skills.lock handling
│   ├── installer.ts        # Multi-agent installation
│   ├── agent-registry.ts   # Agent type definitions
│   └── skill-parser.ts     # SKILL.md parsing
├── types/            # TypeScript type definitions
└── utils/            # Shared utilities
    ├── fs.ts         # File system helpers
    ├── git.ts        # Git operations
    └── logger.ts     # Logging utilities
```

### Core Module Responsibilities

- **SkillManager:** Main orchestrator integrating all components
- **GitResolver:** Parse skill references, resolve versions, build repo URLs
- **CacheManager:** Global cache at ~/.reskill-cache
- **ConfigLoader:** Read/write skills.json
- **LockManager:** Read/write skills.lock for version locking
- **Installer:** Handle multi-agent installation (symlink/copy)
- **AgentRegistry:** Define supported agents and their paths

## CLI Command Pattern

Each command follows this structure:

```typescript
import { Command } from 'commander';
import { SkillManager } from '../../core/skill-manager.js';
import { logger } from '../../utils/logger.js';

export const myCommand = new Command('my-command')
  .description('Description in English')
  .argument('[arg]', 'Argument description')
  .option('-f, --force', 'Force operation')
  .action(async (arg, options) => {
    const manager = new SkillManager(process.cwd());
    try {
      // Command implementation
      logger.success('Operation completed');
    } catch (error) {
      logger.error(`Failed: ${(error as Error).message}`);
      process.exit(1);
    }
  });
```

## Git Commit Guidelines

- Write commit messages in English
- Use conventional commit format: `type(scope): description`
- Types: feat, fix, docs, style, refactor, test, chore
- Keep commits focused and atomic

```
feat(cli): add multi-agent support for install command
fix(cache): handle symlink creation on Windows
test(core): add unit tests for GitResolver
```

## Changeset Guidelines

This project uses [Changesets](https://github.com/changesets/changesets) for version management and publishing.

### When to Add a Changeset

**REQUIRED** - You MUST add a changeset when:
- Adding new features (minor version bump)
- Fixing bugs (patch version bump)
- Making breaking changes (major version bump)
- Any change that affects the public API or behavior

**NOT REQUIRED** - You can skip changeset for:
- Documentation-only changes
- Internal refactoring that doesn't change behavior
- Test-only changes

### Creating a Changeset

After completing your changes, run:

```bash
pnpm changeset
```

Follow the prompts to select:
- **Version type**: `patch` (bug fix), `minor` (new feature), `major` (breaking change)
- **Change description**: Brief summary of your changes

This creates a markdown file in `.changeset/` documenting your changes.

### Changeset File Format

Changeset files should be written in **both English and Chinese** (bilingual) for better accessibility. The format should be **English first, then Chinese**, separated by a horizontal rule (`---`):

```markdown
---
"reskill": minor
---

Brief English summary

**Changes:**
- English change description
- Another change in English

**Bug Fixes:**
- English bug fix description

---

简短的中文摘要

**主要变更：**
- 中文变更描述
- 另一个变更的中文描述

**问题修复：**
- 中文问题修复描述
```

### Changeset Content Guidelines

1. **Title**: Brief summary in both English and Chinese (English first, then Chinese)
2. **Structure**: All English content first, then all Chinese content, separated by `---`
3. **Sections**: Use English headers (`**Changes:**`, `**Bug Fixes:**`) in English section, Chinese headers (`**主要变更：**`, `**问题修复：**`) in Chinese section
4. **Organization**: Organize by category (Changes, Bug Fixes, Backward Compatibility, etc.) in both sections

### Release Workflow

1. **Add Changeset**: Create changeset file with `pnpm changeset`
2. **Submit PR**: Commit changeset file along with your code changes
3. **Merge PR**: When PR is merged to `main`, CI automatically creates a "Version Packages" PR
4. **Review & Merge**: Review the version bump and changelog, then merge the "Version Packages" PR
5. **Auto Publish**: CI automatically publishes to npm after the version PR is merged

### Version Bump Types

| Type | Version Change | Use Case | 使用场景 |
|------|----------------|----------|----------|
| `patch` | 0.1.0 → 0.1.1 | Bug fixes, documentation updates | Bug 修复，文档更新 |
| `minor` | 0.1.0 → 0.2.0 | New features (backward compatible) | 新功能（向后兼容） |
| `major` | 0.1.0 → 1.0.0 | Breaking changes | 破坏性变更 |

### Common Commands

```bash
# Add changeset (interactive)
pnpm changeset

# Preview version changes (dry run)
pnpm changeset status

# Apply version changes locally (CI handles this automatically)
pnpm version

# Publish to npm (CI handles this automatically)
pnpm release
```

## Development Workflow

```bash
# Install dependencies
pnpm install

# Development mode (watch)
pnpm dev

# Build
pnpm build

# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Type checking
pnpm typecheck
```

## File Operations

Always use utility functions from `src/utils/fs.ts`:

```typescript
import {
  exists,
  readJson,
  writeJson,
  remove,
  ensureDir,
  createSymlink,
} from '../utils/fs.js';
```

## Logging

Use the logger from `src/utils/logger.ts`:

```typescript
import { logger } from '../utils/logger.js';

logger.info('Processing...');
logger.success('Done!');
logger.warn('Warning message');
logger.error('Error message');
logger.debug('Debug info');  // Only shown with DEBUG env
logger.package('📦 Installing...');  // For package operations
```
