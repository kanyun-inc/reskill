/**
 * Windows-specific --base-dir Resolution Tests
 *
 * These tests simulate Windows path semantics by mocking `node:path` with its
 * `win32` implementation. Contributors and CI run on macOS/Linux, where a
 * backslash is an ordinary filename character, so Windows separator handling
 * would otherwise never be exercised.
 *
 * The filesystem checks are stubbed out: this file is about how a supplied
 * path is normalized, not about what exists on disk.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path');
  return { ...actual.win32, default: actual.win32 };
});

vi.mock('./fs.js', () => ({
  exists: vi.fn(() => true),
  isDirectory: vi.fn(() => true),
}));

const { resolveBaseDir } = await import('./base-dir.js');

describe('resolveBaseDir (Windows path semantics)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('absolute paths', () => {
    it('returns a drive-letter path unchanged', () => {
      expect(resolveBaseDir('C:\\agents\\foo')).toBe('C:\\agents\\foo');
    });

    it('normalizes a trailing separator away', () => {
      expect(resolveBaseDir('C:\\agents\\foo\\')).toBe('C:\\agents\\foo');
    });

    it('normalizes traversal segments', () => {
      expect(resolveBaseDir('C:\\agents\\foo\\..\\bar')).toBe('C:\\agents\\bar');
    });
  });

  describe('relative paths', () => {
    it('treats a backslash as a separator, not a filename character', () => {
      vi.spyOn(process, 'cwd').mockReturnValue('C:\\workspace');

      // On POSIX this would resolve to a single literal "agents\foo" segment;
      // on Windows it must nest into agents\foo.
      expect(resolveBaseDir('agents\\foo')).toBe('C:\\workspace\\agents\\foo');
    });

    it('also accepts forward slashes, which Windows allows', () => {
      vi.spyOn(process, 'cwd').mockReturnValue('C:\\workspace');

      expect(resolveBaseDir('agents/foo')).toBe('C:\\workspace\\agents\\foo');
    });

    it('resolves against the drive root when cwd is a drive root', () => {
      vi.spyOn(process, 'cwd').mockReturnValue('D:\\');

      expect(resolveBaseDir('agents\\bar')).toBe('D:\\agents\\bar');
    });
  });

  describe('validation still applies', () => {
    it('rejects an empty value before touching the filesystem', () => {
      expect(() => resolveBaseDir('   ')).toThrow(/requires a non-empty directory path/);
    });

    it('rejects the --global combination', () => {
      expect(() => resolveBaseDir('C:\\agents\\foo', { global: true })).toThrow(
        /cannot be combined with --global/,
      );
    });
  });
});
