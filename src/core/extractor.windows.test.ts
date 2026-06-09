/**
 * Windows-specific Tarball Extractor Tests
 *
 * These tests simulate Windows path semantics by mocking `node:path` with its
 * `win32` implementation. The extractor runs on contributors' macOS/Linux
 * machines and on CI, so the Windows-only path-safety bug would otherwise never
 * be exercised.
 *
 * Bug: isPathSafe() compared resolved paths using a hardcoded '/' separator,
 * which never matches Windows '\' separators, causing every tarball entry to be
 * rejected and skills to extract into an empty directory.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path');
  return { ...actual.win32, default: actual.win32 };
});

const { isPathSafe } = await import('./extractor.js');

describe('extractor (Windows path semantics)', () => {
  const installDir = 'C:\\Users\\alice\\.reskill-cache\\registry-temp\\skill-foo-1.0.0';

  describe('isPathSafe with backslash separators', () => {
    it('allows a normal skill entry under installDir', () => {
      expect(isPathSafe(installDir, 'skill-foo/SKILL.md')).toBe(true);
    });

    it('allows nested skill entries', () => {
      expect(isPathSafe(installDir, 'skill-foo/scripts/init.sh')).toBe(true);
      expect(isPathSafe(installDir, 'skill-foo/a/b/c/deep.txt')).toBe(true);
    });

    it('still blocks parent-directory escape', () => {
      expect(isPathSafe(installDir, '../etc/passwd')).toBe(false);
      expect(isPathSafe(installDir, 'skill/../../etc/passwd')).toBe(false);
    });

    it('still blocks absolute paths', () => {
      expect(isPathSafe(installDir, 'C:\\Windows\\System32\\evil.dll')).toBe(false);
    });
  });
});
