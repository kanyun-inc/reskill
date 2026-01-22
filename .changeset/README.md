# Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for version management and publishing.

## Development Workflow

### 1. Add a Changeset

After completing a feature or fix, run:

```bash
pnpm changeset
```

Follow the prompts to select:
- **Version type**: `patch` (bug fix), `minor` (new feature), `major` (breaking change)
- **Change description**: Brief summary of your changes

This creates a markdown file in `.changeset/` documenting your changes.

### 2. Submit PR

Commit the changeset file along with your code changes in the PR.

### 3. Automated Release

When the PR is merged to `main`:

1. **If there are pending changesets**: CI automatically creates a "Version Packages" PR containing:
   - Updated `package.json` version
   - Updated `CHANGELOG.md`

2. **Merge the "Version Packages" PR**: CI automatically publishes to npm

## Common Commands

```bash
# Add changeset (interactive)
pnpm changeset

# Preview version changes (dry run)
pnpm changeset status

# Apply version changes locally (CI handles this)
# Note: Use 'pnpm run version' or 'pnpm changeset version', NOT 'pnpm version'
# 'pnpm version' without 'run' is a built-in pnpm command that shows version info
pnpm run version
# or
pnpm changeset version

# Publish to npm (CI handles this)
pnpm release
```

## Changeset Types

| Type | Version Change | Use Case |
|------|----------------|----------|
| `patch` | 0.1.0 → 0.1.1 | Bug fixes, documentation updates |
| `minor` | 0.1.0 → 0.2.0 | New features (backward compatible) |
| `major` | 0.1.0 → 1.0.0 | Breaking changes |
