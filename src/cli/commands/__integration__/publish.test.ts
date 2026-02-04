/**
 * CLI Integration Tests: publish command
 *
 * Tests for the publish command --dry-run validation
 * (API calls are not tested here, only local validation)
 *
 * Following agentskills.io specification:
 * - SKILL.md is REQUIRED with name and description in frontmatter
 * - skill.json is OPTIONAL for additional metadata
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempDir, getOutput, removeTempDir, runCli } from './helpers.js';

// Test registry URL (a private registry for testing)
const TEST_REGISTRY = 'https://test-registry.example.com';

describe('CLI Integration: publish', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  // Helper functions
  function createSkillJson(content: object): void {
    fs.writeFileSync(path.join(tempDir, 'skill.json'), JSON.stringify(content, null, 2));
  }

  function createSkillMd(content: string): void {
    fs.writeFileSync(path.join(tempDir, 'SKILL.md'), content);
  }

  /** Create a valid SKILL.md with required frontmatter */
  function createValidSkillMd(name = 'my-skill', description = 'A helpful AI skill'): void {
    createSkillMd(`---
name: ${name}
description: ${description}
---
# ${name}

This is the skill content.`);
  }

  function initGitRepo(): void {
    execSync('git init', { cwd: tempDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'pipe' });
  }

  function gitCommit(message = 'test commit'): string {
    execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
    execSync(`git commit -m "${message}"`, { cwd: tempDir, stdio: 'pipe' });
    return execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf-8' }).trim();
  }

  function gitTag(tag: string): void {
    execSync(`git tag ${tag}`, { cwd: tempDir, stdio: 'pipe' });
  }

  function setRemote(url: string): void {
    execSync(`git remote add origin ${url}`, { cwd: tempDir, stdio: 'pipe' });
  }

  // ============================================================================
  // --help tests
  // ============================================================================

  describe('--help', () => {
    it('should show help message', () => {
      const { stdout, exitCode } = runCli('publish --help', tempDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Publish a skill to the registry');
      expect(stdout).toContain('--dry-run');
      expect(stdout).toContain('--registry');
      expect(stdout).toContain('--tag');
      expect(stdout).toContain('--yes');
    });

    it('should show alias pub', () => {
      const { stdout, exitCode } = runCli('pub --help', tempDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Publish a skill to the registry');
    });
  });

  // ============================================================================
  // --dry-run validation: SKILL.md (required per agentskills.io spec)
  // ============================================================================

  describe('--dry-run: SKILL.md validation (required)', () => {
    it('should fail without SKILL.md', () => {
      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('SKILL.md');
      expect(getOutput(result)).toContain('not found');
    });

    it('should fail when SKILL.md has no frontmatter', () => {
      createSkillMd('# My Skill\n\nNo frontmatter here.');

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('frontmatter');
    });

    it('should fail without name in SKILL.md', () => {
      createSkillMd(`---
description: Test skill
---
# Content`);

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('SKILL.md');
    });

    it('should fail without description in SKILL.md', () => {
      createSkillMd(`---
name: my-skill
---
# Content`);

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('SKILL.md');
    });

    it('should fail with uppercase name in SKILL.md', () => {
      createSkillMd(`---
name: MySkill
description: Test skill
---
# Content`);

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('lowercase');
    });

    it('should fail with name starting with hyphen', () => {
      createSkillMd(`---
name: -my-skill
description: Test skill
---
# Content`);

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(1);
    });

    it('should pass with valid SKILL.md only (no skill.json)', () => {
      createValidSkillMd();

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toContain('Dry run');
      expect(getOutput(result)).toContain('my-skill');
      expect(getOutput(result)).toContain('No changes made');
    });

    // Removed: skill.json is no longer used, no warning expected
  });

  // ============================================================================
  // --dry-run: skill.json is ignored (SKILL.md is sole source)
  // ============================================================================

  describe('--dry-run: skill.json is ignored (SKILL.md is sole source)', () => {
    it('should pass even with invalid JSON in skill.json', () => {
      createValidSkillMd();
      fs.writeFileSync(path.join(tempDir, 'skill.json'), '{ invalid json }');

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      // skill.json is ignored, so should pass
      expect(result.exitCode).toBe(0);
    });

    it('should ignore skill.json name since SKILL.md name is authoritative', () => {
      // SKILL.md name is the sole authority now - skill.json name is ignored
      createValidSkillMd('my-skill');
      createSkillJson({
        name: 'different-skill', // This name is ignored
        version: '1.0.0',
        description: 'Test skill',
      });

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      // Should pass validation since SKILL.md name is authoritative
      expect(result.exitCode).toBe(0);
      // Should use SKILL.md name, not skill.json name
      expect(getOutput(result)).toContain('my-skill');
      expect(getOutput(result)).not.toContain('mismatch');
    });

    it('should ignore skill.json version and use SKILL.md version', () => {
      createSkillMd(`---
name: my-skill
description: A helpful AI skill
version: 2.0.0
---
# Content`);
      createSkillJson({
        name: 'my-skill',
        version: '1.0.0', // This is ignored
        description: 'A helpful AI skill',
      });

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toContain('2.0.0'); // SKILL.md version
    });
  });

  // ============================================================================
  // --dry-run: SKILL.md is sole source of metadata
  // ============================================================================

  describe('--dry-run: SKILL.md is sole source of metadata', () => {
    it('should load all metadata from SKILL.md', () => {
      createSkillMd(`---
name: my-skill
description: A helpful AI skill
version: 1.5.0
license: MIT
---
# Content`);

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toContain('SKILL.md found');
      expect(getOutput(result)).toContain('Metadata loaded from SKILL.md');
      expect(getOutput(result)).toContain('1.5.0');
    });

    it('should use version from SKILL.md frontmatter', () => {
      createSkillMd(`---
name: my-skill
description: Test skill
version: 2.5.0
---
# Content`);

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toContain('2.5.0');
    });
  });

  // ============================================================================
  // --dry-run validation: Git information
  // ============================================================================

  describe('--dry-run: Git information', () => {
    it('should show commit information', () => {
      createValidSkillMd();
      initGitRepo();
      gitCommit();

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toContain('Commit');
    });

    it('should show tag information', () => {
      createValidSkillMd();
      initGitRepo();
      gitCommit();
      gitTag('v1.0.0');

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toContain('v1.0.0');
    });

    it('should show repository URL', () => {
      createValidSkillMd();
      initGitRepo();
      gitCommit();
      setRemote('https://github.com/user/my-skill.git');

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toContain('github.com');
    });

    it('should warn about dirty working tree', () => {
      createValidSkillMd();
      initGitRepo();
      gitCommit();

      // Create uncommitted file
      fs.writeFileSync(path.join(tempDir, 'uncommitted.txt'), 'uncommitted content');

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toContain('uncommitted');
    });

    it('should use specified tag with --tag', () => {
      createValidSkillMd();
      initGitRepo();
      gitCommit();
      gitTag('v1.0.0');

      // Add another commit
      fs.writeFileSync(path.join(tempDir, 'new-file.txt'), 'new content');
      gitCommit('second commit');
      gitTag('v2.0.0');

      const result = runCli(`publish --dry-run --tag v1.0.0 --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toContain('v1.0.0');
    });

    it('should fail with non-existent tag', () => {
      createValidSkillMd();
      initGitRepo();
      gitCommit();

      const result = runCli(
        `publish --dry-run --tag v999.0.0 --registry ${TEST_REGISTRY}`,
        tempDir,
      );

      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('not found');
    });

    it('should work without git repository', () => {
      createValidSkillMd();

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      // Should pass but without git info
      expect(result.exitCode).toBe(0);
    });
  });

  // ============================================================================
  // --dry-run: Files listing
  // ============================================================================

  describe('--dry-run: Files listing', () => {
    it('should list files to publish', () => {
      createValidSkillMd();
      createSkillJson({
        name: 'my-skill',
        version: '1.0.0',
        description: 'Test skill',
      });

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toContain('skill.json');
      expect(getOutput(result)).toContain('SKILL.md');
    });

    it('should include files from files array', () => {
      createValidSkillMd();
      fs.mkdirSync(path.join(tempDir, 'examples'));
      fs.writeFileSync(path.join(tempDir, 'examples', 'basic.md'), '# Basic Example');

      createSkillJson({
        name: 'my-skill',
        version: '1.0.0',
        description: 'Test skill',
        files: ['examples/'],
      });

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toContain('examples');
    });

    it('should show total file count and size', () => {
      createValidSkillMd();

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toMatch(/\d+ files?/);
    });
  });

  // ============================================================================
  // --dry-run: Integrity hash
  // ============================================================================

  describe('--dry-run: Integrity hash', () => {
    it('should display integrity hash', () => {
      createValidSkillMd();

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toMatch(/sha256-[a-f0-9]{64}/);
    });
  });

  // ============================================================================
  // --dry-run: Metadata display
  // ============================================================================

  describe('--dry-run: Metadata display', () => {
    // Note: Keywords from SKILL.md metadata aren't fully supported by the simple YAML parser
    // So we only test license which is a top-level field

    it('should display license from SKILL.md', () => {
      createSkillMd(`---
name: my-skill
description: Test skill
license: MIT
---
# Content`);

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toContain('MIT');
    });

    it('should display compatibility from SKILL.md', () => {
      createSkillMd(`---
name: my-skill
description: Test skill
compatibility: cursor >=0.40
---
# Content`);

      const result = runCli(`publish --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toContain('cursor');
    });
  });

  // ============================================================================
  // Blocked public registry
  // ============================================================================

  describe('blocked public registry', () => {
    it('should block publishing to reskill.info', () => {
      createValidSkillMd();

      const result = runCli('publish --dry-run --registry https://reskill.info', tempDir);

      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('public registry is not supported');
      expect(getOutput(result)).toContain('web interface');
    });

    it('should block publishing to www.reskill.info', () => {
      createValidSkillMd();

      const result = runCli('publish --dry-run --registry https://www.reskill.info', tempDir);

      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('public registry is not supported');
    });

    it('should block publishing to api.reskill.info', () => {
      createValidSkillMd();

      const result = runCli('publish --dry-run --registry https://api.reskill.info/v1', tempDir);

      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('public registry is not supported');
    });

    it('should block publishing to registry.reskill.info', () => {
      createValidSkillMd();

      const result = runCli('publish --dry-run --registry https://registry.reskill.info', tempDir);

      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('public registry is not supported');
    });

    it('should block publishing to subdomain of reskill.info', () => {
      createValidSkillMd();

      const result = runCli(
        'publish --dry-run --registry https://subdomain.api.reskill.info',
        tempDir,
      );

      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('public registry is not supported');
    });

    it('should allow publishing to private registry', () => {
      createValidSkillMd();

      const result = runCli(
        'publish --dry-run --registry https://reskill-test.zhenguanyu.com',
        tempDir,
      );

      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toContain('Dry run');
      expect(getOutput(result)).toContain('No changes made');
    });

    it('should allow publishing to other private domains', () => {
      createValidSkillMd();

      const result = runCli(
        'publish --dry-run --registry https://my-private-registry.example.com',
        tempDir,
      );

      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toContain('Dry run');
    });

    it('should show helpful message when blocked', () => {
      createValidSkillMd();

      const result = runCli('publish --dry-run --registry https://reskill.info', tempDir);

      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('reskill.info/submit');
      expect(getOutput(result)).toContain('private registries');
    });
  });

  // ============================================================================
  // Authentication check (without --dry-run)
  // ============================================================================

  describe('authentication check', () => {
    it('should fail without token when not using --dry-run', () => {
      createValidSkillMd();

      const result = runCli('publish --yes --registry https://private.registry.com', tempDir);

      expect(result.exitCode).not.toBe(0);
      expect(getOutput(result)).toContain('login');
    });

    it('should not require auth for --dry-run', () => {
      createValidSkillMd();

      const result = runCli('publish --dry-run --registry https://private.registry.com', tempDir);

      expect(result.exitCode).toBe(0);
      // Should not mention login
    });
  });

  // ============================================================================
  // Path argument
  // ============================================================================

  describe('path argument', () => {
    it('should publish from specified directory', () => {
      const subDir = path.join(tempDir, 'subdir');
      fs.mkdirSync(subDir);
      fs.writeFileSync(
        path.join(subDir, 'SKILL.md'),
        `---
name: sub-skill
description: A skill in subdirectory
---
# Sub Skill`,
      );

      const result = runCli(`publish ${subDir} --dry-run --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toContain('sub-skill');
    });

    it('should fail with non-existent directory', () => {
      const result = runCli(
        `publish /nonexistent/path --dry-run --registry ${TEST_REGISTRY}`,
        tempDir,
      );

      expect(result.exitCode).toBe(1);
    });
  });

  // ============================================================================
  // Custom entry file
  // ============================================================================

  // Custom entry file validation removed: SKILL.md is always the entry point
  // skill.json entry field is ignored

  // ============================================================================
  // No registry specified
  // ============================================================================

  describe('no registry specified', () => {
    it('should fail when no registry is configured', () => {
      createValidSkillMd();

      const result = runCli('publish --dry-run', tempDir);

      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('No registry specified');
      expect(getOutput(result)).toContain('--registry');
      expect(getOutput(result)).toContain('RESKILL_REGISTRY');
      expect(getOutput(result)).toContain('publishRegistry');
    });
  });

  // ============================================================================
  // Missing version behavior
  // ============================================================================

  describe('missing version in SKILL.md', () => {
    beforeEach(() => {
      initGitRepo();
    });

    it('should use 0.0.0 with warning in --yes mode when version is missing', () => {
      // Create SKILL.md without version
      createSkillMd(`---
name: my-skill
description: A helpful AI skill
---
# my-skill

This is the skill content.`);
      gitCommit('add skill');

      // With --yes flag, should use 0.0.0 and show warning
      const result = runCli(`publish --dry-run --yes --registry ${TEST_REGISTRY}`, tempDir);

      expect(result.exitCode).toBe(0);
      // Should show warning about missing version
      expect(getOutput(result)).toContain('No version specified');
      expect(getOutput(result)).toContain('0.0.0');
    });

    // Note: Interactive mode testing (prompting for version) would require
    // stdin input which is not supported by the current test helper.
    // The interactive flow is tested via the unit tests for parseVersionInput.
  });
});
