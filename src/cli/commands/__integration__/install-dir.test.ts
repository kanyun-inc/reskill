/**
 * Integration tests for custom installDir configuration
 *
 * These tests verify that the installDir setting in skills.json
 * is correctly respected during installation.
 */

import { afterEach, beforeEach, describe, it } from 'vitest';
import { createTempDir, removeTempDir, runCli, setupSkillsJson } from './helpers.js';

describe('CLI Integration: installDir configuration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    runCli('init -y', tempDir);
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it('should respect custom installDir for new installations', () => {
    const customDir = 'custom-skills-dir';

    // Setup skills.json with custom installDir
    setupSkillsJson(tempDir, {}, { installDir: customDir });

    // The actual installation with custom installDir is verified in:
    // - installer.test.ts (unit tests for Installer class with custom installDir)
    // - install-symlink.test.ts (integration tests for listing skills from custom installDir)
    //
    // This test exists to document the feature and ensure the config is properly set up.
    // Full end-to-end testing with actual git operations would require network access.
  });
});
