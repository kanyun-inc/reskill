import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveBaseDir } from './base-dir.js';
import { remove } from './fs.js';

describe('resolveBaseDir', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    // macOS reports /var as a symlink to /private/var, so realpath-normalize
    // the temp root to keep absolute-path assertions exact.
    tempDir = realpathSync(mkdtempSync(path.join(tmpdir(), 'reskill-base-dir-')));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    remove(tempDir);
  });

  describe('when the option is not supplied', () => {
    it('returns undefined so callers keep process.cwd() behavior', () => {
      expect(resolveBaseDir(undefined)).toBeUndefined();
    });

    it('returns undefined even when --global is set', () => {
      expect(resolveBaseDir(undefined, { global: true })).toBeUndefined();
    });
  });

  describe('resolving valid directories', () => {
    it('returns an existing absolute path unchanged', () => {
      expect(resolveBaseDir(tempDir)).toBe(path.resolve(tempDir));
    });

    it('resolves a relative path against the current working directory', () => {
      process.chdir(tempDir);
      const agentDir = path.join(tempDir, 'agents', 'foo');
      mkdirSync(agentDir, { recursive: true });

      expect(resolveBaseDir('agents/foo')).toBe(path.resolve(tempDir, 'agents/foo'));
    });

    it('trims surrounding whitespace before resolving', () => {
      expect(resolveBaseDir(`  ${tempDir}  `)).toBe(path.resolve(tempDir));
    });

    it('normalizes traversal segments in the supplied path', () => {
      const nested = path.join(tempDir, 'agents');
      mkdirSync(nested, { recursive: true });

      expect(resolveBaseDir(path.join(nested, '..'))).toBe(path.resolve(tempDir));
    });
  });

  describe('rejecting invalid values', () => {
    it('throws when the directory does not exist', () => {
      const missing = path.join(tempDir, 'no-such-agent');

      expect(() => resolveBaseDir(missing)).toThrow(/--base-dir directory not found/);
    });

    it('names the resolved absolute path in the not-found error', () => {
      const missing = path.join(tempDir, 'no-such-agent');

      expect(() => resolveBaseDir(missing)).toThrow(missing);
    });

    it('throws when the path points to a file instead of a directory', () => {
      const filePath = path.join(tempDir, 'skills.json');
      writeFileSync(filePath, '{}');

      expect(() => resolveBaseDir(filePath)).toThrow(/--base-dir must point to a directory/);
    });

    it('throws on an empty string', () => {
      expect(() => resolveBaseDir('')).toThrow(/requires a non-empty directory path/);
    });

    it('throws on a whitespace-only string', () => {
      expect(() => resolveBaseDir('   ')).toThrow(/requires a non-empty directory path/);
    });
  });

  describe('conflict with --global', () => {
    it('throws when combined with --global', () => {
      expect(() => resolveBaseDir(tempDir, { global: true })).toThrow(
        /--base-dir cannot be combined with --global/,
      );
    });

    it('rejects the combination before validating the directory exists', () => {
      const missing = path.join(tempDir, 'no-such-agent');

      // The global conflict is a usage error, so it must win over path checks
      // to avoid a confusing "not found" message for an unsupported flag combo.
      expect(() => resolveBaseDir(missing, { global: true })).toThrow(
        /cannot be combined with --global/,
      );
    });

    it('resolves normally when global is explicitly false', () => {
      expect(resolveBaseDir(tempDir, { global: false })).toBe(path.resolve(tempDir));
    });
  });
});
