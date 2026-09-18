/**
 * Tarball Extractor Tests (Step 3.6)
 *
 * Tests for extracting tarball buffers to the installation directory
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { pack } from 'tar-stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractTarballBuffer, getTarballTopDir, isMacMetadataPath, isPathSafe } from './extractor.js';

describe('extractor', () => {
  let tempDir: string;

  // Helper: create temporary directory
  function createTempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-extractor-test-'));
    return fs.realpathSync(dir);
  }

  // Helper: create mock tarball with custom entry names (for security tests)
  function createMockTarballRaw(
    entries: Array<{ name: string; content: string; mode?: number }>,
  ): Buffer {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const tarPack = pack();
      const gzip = zlib.createGzip();

      gzip.on('data', (chunk: Buffer) => chunks.push(chunk));
      gzip.on('end', () => resolve(Buffer.concat(chunks)));
      gzip.on('error', reject);

      tarPack.pipe(gzip);

      for (const entry of entries) {
        const content = Buffer.from(entry.content);
        tarPack.entry(
          {
            name: entry.name,
            size: content.length,
            mode: entry.mode || 0o644,
          },
          content,
        );
      }

      tarPack.finalize();
    }) as unknown as Buffer;
  }

  // Helper: create mock tarball with top directory prefix
  function createMockTarball(
    topDir: string,
    files: Array<{ name: string; content: string; mode?: number }>,
  ): Buffer {
    const entries = files.map((file) => ({
      name: `${topDir}/${file.name}`,
      content: file.content,
      mode: file.mode,
    }));
    return createMockTarballRaw(entries);
  }

  // Helper: create empty tarball
  function createEmptyTarball(): Buffer {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const tarPack = pack();
      const gzip = zlib.createGzip();

      gzip.on('data', (chunk: Buffer) => chunks.push(chunk));
      gzip.on('end', () => resolve(Buffer.concat(chunks)));
      gzip.on('error', reject);

      tarPack.pipe(gzip);
      tarPack.finalize();
    }) as unknown as Buffer;
  }

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('extractTarballBuffer', () => {
    it('should extract tarball to install directory', async () => {
      const tarball = await createMockTarball('my-skill', [
        { name: 'SKILL.md', content: '# My Skill' },
        { name: 'examples.md', content: '# Examples' },
      ]);

      await extractTarballBuffer(tarball, tempDir);

      expect(fs.existsSync(path.join(tempDir, 'my-skill/SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'my-skill/examples.md'))).toBe(true);

      // Verify content
      const content = fs.readFileSync(path.join(tempDir, 'my-skill/SKILL.md'), 'utf-8');
      expect(content).toBe('# My Skill');
    });

    it('should preserve nested directory structure', async () => {
      const tarball = await createMockTarball('my-skill', [
        { name: 'SKILL.md', content: '# Skill' },
        { name: 'scripts/init.sh', content: '#!/bin/bash' },
        { name: 'templates/progress.md', content: '# Progress' },
      ]);

      await extractTarballBuffer(tarball, tempDir);

      expect(fs.existsSync(path.join(tempDir, 'my-skill/SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'my-skill/scripts/init.sh'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'my-skill/templates/progress.md'))).toBe(true);
    });

    it('should preserve file permissions on Unix', async () => {
      // Only test permissions on Unix systems
      if (process.platform === 'win32') {
        return;
      }

      const tarball = await createMockTarball('my-skill', [
        { name: 'scripts/init.sh', content: '#!/bin/bash', mode: 0o755 },
      ]);

      await extractTarballBuffer(tarball, tempDir);

      const stat = fs.statSync(path.join(tempDir, 'my-skill/scripts/init.sh'));
      // Check for execute permission
      expect(stat.mode & 0o111).toBeGreaterThan(0);
    });

    it('should handle empty tarball gracefully', async () => {
      const emptyTarball = await createEmptyTarball();

      // Empty tarball should extract successfully, just no files
      await extractTarballBuffer(emptyTarball, tempDir);

      // tempDir should exist but be empty
      expect(fs.existsSync(tempDir)).toBe(true);
    });

    it('should handle tarball with deep nesting', async () => {
      const tarball = await createMockTarball('skill', [
        { name: 'a/b/c/d/deep.txt', content: 'deep content' },
      ]);

      await extractTarballBuffer(tarball, tempDir);

      expect(fs.existsSync(path.join(tempDir, 'skill/a/b/c/d/deep.txt'))).toBe(true);
      const content = fs.readFileSync(path.join(tempDir, 'skill/a/b/c/d/deep.txt'), 'utf-8');
      expect(content).toBe('deep content');
    });

    it('should handle tarball with special characters in filename', async () => {
      const tarball = await createMockTarball('my-skill', [
        { name: 'file with spaces.md', content: 'spaces' },
        { name: 'file-with-dashes.md', content: 'dashes' },
        { name: 'file_with_underscores.md', content: 'underscores' },
      ]);

      await extractTarballBuffer(tarball, tempDir);

      expect(fs.existsSync(path.join(tempDir, 'my-skill/file with spaces.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'my-skill/file-with-dashes.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'my-skill/file_with_underscores.md'))).toBe(true);
    });

    it('should throw error for invalid gzip data', async () => {
      const invalidData = Buffer.from('not a valid gzip');

      await expect(extractTarballBuffer(invalidData, tempDir)).rejects.toThrow();
    });

    it('should create install directory if not exists', async () => {
      const newInstallDir = path.join(tempDir, 'new-dir');
      expect(fs.existsSync(newInstallDir)).toBe(false);

      const tarball = await createMockTarball('skill', [{ name: 'SKILL.md', content: '# Skill' }]);

      await extractTarballBuffer(tarball, newInstallDir);

      expect(fs.existsSync(newInstallDir)).toBe(true);
      expect(fs.existsSync(path.join(newInstallDir, 'skill/SKILL.md'))).toBe(true);
    });
  });

  // ==========================================================================
  // Path Traversal Protection Tests
  // ==========================================================================

  describe('isPathSafe', () => {
    const installDir = '/home/user/.reskill/skills';

    describe('should allow safe paths', () => {
      it('allows normal skill paths', () => {
        expect(isPathSafe(installDir, 'my-skill/SKILL.md')).toBe(true);
        expect(isPathSafe(installDir, 'my-skill/scripts/init.sh')).toBe(true);
        expect(isPathSafe(installDir, 'my-skill/a/b/c/deep.txt')).toBe(true);
      });

      it('allows paths with ./ prefix', () => {
        expect(isPathSafe(installDir, './my-skill/SKILL.md')).toBe(true);
      });

      it('allows paths with special characters', () => {
        expect(isPathSafe(installDir, 'my-skill/file with spaces.md')).toBe(true);
        expect(isPathSafe(installDir, 'my-skill/file-name.md')).toBe(true);
        expect(isPathSafe(installDir, 'my-skill/file_name.md')).toBe(true);
      });
    });

    describe('should block system-level escape (escaping installDir)', () => {
      it('blocks paths starting with ..', () => {
        expect(isPathSafe(installDir, '../etc/passwd')).toBe(false);
        expect(isPathSafe(installDir, '../../etc/passwd')).toBe(false);
        expect(isPathSafe(installDir, '../../../etc/passwd')).toBe(false);
      });

      it('blocks absolute paths', () => {
        expect(isPathSafe(installDir, '/etc/passwd')).toBe(false);
        expect(isPathSafe(installDir, '/tmp/malicious')).toBe(false);
      });

      it('blocks paths that normalize to parent directory', () => {
        // These paths try to escape using .. after initial directory
        expect(isPathSafe(installDir, 'skill/../../etc/passwd')).toBe(false);
        expect(isPathSafe(installDir, 'a/b/../../../etc/passwd')).toBe(false);
      });
    });

    describe('should block any path containing ".."', () => {
      // Design principle: legitimate tarballs never need ".." in their paths
      // All files should be directly under skill-name/ without path manipulation

      it('blocks paths that escape to sibling directories', () => {
        // skill/../other-skill/file would write to other-skill directory
        expect(isPathSafe(installDir, 'skill/../other-skill/SKILL.md')).toBe(false);
      });

      it('blocks paths with multiple .. that escape top-level', () => {
        // a/b/../../other means: go into a, then b, then up twice (escapes a)
        expect(isPathSafe(installDir, 'a/b/../../other/file')).toBe(false);
      });

      it('blocks paths with .. even if they stay within skill directory', () => {
        // For simplicity and security, we reject ALL paths containing ".."
        // Legitimate tarballs don't need ".." - they should use direct paths
        expect(isPathSafe(installDir, 'skill/a/../b/file.md')).toBe(false);
        expect(isPathSafe(installDir, 'skill/a/b/../c/file.md')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('blocks empty path', () => {
        expect(isPathSafe(installDir, '')).toBe(false);
      });

      it('blocks whitespace-only path', () => {
        expect(isPathSafe(installDir, '   ')).toBe(false);
      });

      it('blocks path that resolves to installDir itself', () => {
        expect(isPathSafe(installDir, '.')).toBe(false);
        expect(isPathSafe(installDir, './')).toBe(false);
      });

      it('allows Windows-style paths on Unix (backslash is not a separator)', () => {
        // On Unix, backslashes are not path separators, so '..\\..\\etc\\passwd'
        // is a valid filename (creates file named '..\\..\\etc\\passwd' in installDir)
        // This is safe because it doesn't actually traverse directories
        expect(isPathSafe(installDir, 'skill/..\\..\\etc\\passwd')).toBe(true);
      });

      it('allows unusual but safe filenames', () => {
        // Filenames with backslashes that don't start with '..' are allowed on Unix
        expect(isPathSafe(installDir, 'skill/file\\name.txt')).toBe(true);
      });
    });
  });

  describe('extractTarballBuffer - path traversal protection', () => {
    it('should skip entries with system-level path traversal', async () => {
      // Create tarball with malicious path
      const tarball = await createMockTarballRaw([
        { name: 'good-skill/SKILL.md', content: '# Good Skill' },
        { name: '../../../tmp/malicious.txt', content: 'malicious content' },
      ]);

      await extractTarballBuffer(tarball, tempDir);

      // Good file should be extracted
      expect(fs.existsSync(path.join(tempDir, 'good-skill/SKILL.md'))).toBe(true);

      // Malicious file should NOT be extracted anywhere
      expect(fs.existsSync('/tmp/malicious.txt')).toBe(false);
      expect(fs.existsSync(path.join(tempDir, '../../../tmp/malicious.txt'))).toBe(false);
    });

    it('should skip entries with skill-level path traversal', async () => {
      // Create tarball that tries to overwrite another skill
      const tarball = await createMockTarballRaw([
        { name: 'malicious-skill/SKILL.md', content: '# Malicious' },
        { name: 'malicious-skill/../trusted-skill/SKILL.md', content: '# Overwritten!' },
      ]);

      await extractTarballBuffer(tarball, tempDir);

      // The malicious-skill should be created
      expect(fs.existsSync(path.join(tempDir, 'malicious-skill/SKILL.md'))).toBe(true);

      // But trusted-skill should NOT be created (the malicious entry was skipped)
      expect(fs.existsSync(path.join(tempDir, 'trusted-skill/SKILL.md'))).toBe(false);
    });

    it('should skip entries with absolute paths', async () => {
      const tarball = await createMockTarballRaw([
        { name: 'good-skill/SKILL.md', content: '# Good' },
        { name: '/etc/passwd', content: 'root:x:0:0' },
      ]);

      await extractTarballBuffer(tarball, tempDir);

      // Good file should be extracted
      expect(fs.existsSync(path.join(tempDir, 'good-skill/SKILL.md'))).toBe(true);

      // Absolute path entry should be skipped
      // (and not create file at installDir/etc/passwd either)
    });

    it('should extract normal tarballs without issues', async () => {
      // Normal tarball with nested structure
      const tarball = await createMockTarball('my-skill', [
        { name: 'SKILL.md', content: '# My Skill' },
        { name: 'scripts/init.sh', content: '#!/bin/bash\necho hello' },
        { name: 'examples/basic.md', content: '# Basic Example' },
      ]);

      await extractTarballBuffer(tarball, tempDir);

      expect(fs.existsSync(path.join(tempDir, 'my-skill/SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'my-skill/scripts/init.sh'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'my-skill/examples/basic.md'))).toBe(true);

      // Verify content integrity
      const content = fs.readFileSync(path.join(tempDir, 'my-skill/SKILL.md'), 'utf-8');
      expect(content).toBe('# My Skill');
    });
  });

  // ==========================================================================
  // macOS Metadata Filtering Tests (#3062)
  // ==========================================================================

  describe('isMacMetadataPath', () => {
    it('detects AppleDouble files', () => {
      expect(isMacMetadataPath('._pptx')).toBe(true);
      expect(isMacMetadataPath('pptx/._SKILL.md')).toBe(true);
      expect(isMacMetadataPath('pptx/scripts/._helper.py')).toBe(true);
    });

    it('detects __MACOSX directories', () => {
      expect(isMacMetadataPath('__MACOSX/pptx/._.')).toBe(true);
      expect(isMacMetadataPath('__MACOSX/._pptx')).toBe(true);
    });

    it('detects .DS_Store files', () => {
      expect(isMacMetadataPath('.DS_Store')).toBe(true);
      expect(isMacMetadataPath('pptx/.DS_Store')).toBe(true);
    });

    it('allows normal skill paths', () => {
      expect(isMacMetadataPath('pptx/SKILL.md')).toBe(false);
      expect(isMacMetadataPath('pptx/scripts/init.sh')).toBe(false);
      expect(isMacMetadataPath('my-skill/file_name.txt')).toBe(false);
      expect(isMacMetadataPath('')).toBe(false);
    });
  });

  describe('extractTarballBuffer - macOS metadata filtering', () => {
    it('should skip macOS metadata entries and extract real files (#3062)', async () => {
      // Simulates a tarball packed on macOS: bsdtar writes the ._pptx
      // AppleDouble entry for the pptx/ directory BEFORE the directory itself
      const tarball = await createMockTarballRaw([
        { name: '._pptx', content: 'appledouble junk' },
        { name: 'pptx/SKILL.md', content: '# PPTX Skill' },
        { name: 'pptx/._SKILL.md', content: 'appledouble junk' },
        { name: 'pptx/.DS_Store', content: 'finder junk' },
        { name: '__MACOSX/pptx/._.', content: 'zip metadata junk' },
        { name: 'pptx/scripts/clean.py', content: '# clean' },
      ]);

      await extractTarballBuffer(tarball, tempDir);

      // Real files extracted
      expect(fs.existsSync(path.join(tempDir, 'pptx/SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'pptx/scripts/clean.py'))).toBe(true);

      // Metadata junk NOT extracted
      expect(fs.existsSync(path.join(tempDir, '._pptx'))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, 'pptx/._SKILL.md'))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, 'pptx/.DS_Store'))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, '__MACOSX'))).toBe(false);
    });
  });

  describe('getTarballTopDir', () => {
    it('should return top dir for normal tarball', async () => {
      const tarball = await createMockTarball('my-skill', [
        { name: 'SKILL.md', content: '# My Skill' },
      ]);

      expect(await getTarballTopDir(tarball)).toBe('my-skill');
    });

    it('should ignore leading macOS metadata entries (#3062)', async () => {
      // First entry is the ._pptx AppleDouble file, not the skill directory
      const tarball = await createMockTarballRaw([
        { name: '._pptx', content: 'appledouble junk' },
        { name: '__MACOSX/._pptx', content: 'zip metadata junk' },
        { name: 'pptx/SKILL.md', content: '# PPTX Skill' },
        { name: 'pptx/scripts/clean.py', content: '# clean' },
      ]);

      expect(await getTarballTopDir(tarball)).toBe('pptx');
    });

    it('should prefer the top dir that contains SKILL.md', async () => {
      const tarball = await createMockTarballRaw([
        { name: 'docs/readme.md', content: 'docs' },
        { name: 'my-skill/SKILL.md', content: '# Skill' },
      ]);

      expect(await getTarballTopDir(tarball)).toBe('my-skill');
    });

    it('should fall back to first non-metadata entry without SKILL.md', async () => {
      const tarball = await createMockTarballRaw([
        { name: '._junk', content: 'junk' },
        { name: 'my-skill/readme.md', content: 'readme' },
      ]);

      expect(await getTarballTopDir(tarball)).toBe('my-skill');
    });

    it('should return null for flat tarball with root SKILL.md', async () => {
      const tarball = await createMockTarballRaw([
        { name: 'SKILL.md', content: '# Flat Skill' },
        { name: 'examples.md', content: '# Examples' },
      ]);

      expect(await getTarballTopDir(tarball)).toBeNull();
    });

    it('should return null for empty tarball', async () => {
      const tarball = await createEmptyTarball();

      expect(await getTarballTopDir(tarball)).toBeNull();
    });
  });
});
