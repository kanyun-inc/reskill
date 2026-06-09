/**
 * Tarball Extractor (Step 3.6)
 *
 * Extracts tarball buffers to the installation directory.
 * Used for extracting skills downloaded from the registry.
 */

import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { createGunzip } from 'node:zlib';
import { extract, type Headers } from 'tar-stream';

/**
 * Validate that a tarball entry path is safe
 *
 * Prevents path traversal attacks:
 * 1. System-level escape: paths like ../../../etc/passwd that escape installDir
 * 2. Skill-level escape: paths like skill/../other-skill/file that affect other skills
 *
 * Design principle: legitimate tarballs never need ".." in their paths.
 * All files should be under a top-level directory (skill-name/).
 *
 * @param installDir - Installation directory path
 * @param entryName - Entry name from tarball header
 * @returns true if the path is safe, false otherwise
 *
 * @example
 * isPathSafe('/skills', 'my-skill/SKILL.md')           // true
 * isPathSafe('/skills', '../../../etc/passwd')         // false (system escape)
 * isPathSafe('/skills', 'skill/../other/file')         // false (skill escape)
 * isPathSafe('/skills', '/etc/passwd')                 // false (absolute path)
 */
export function isPathSafe(installDir: string, entryName: string): boolean {
  // Empty path is invalid
  if (!entryName || entryName.trim() === '') {
    return false;
  }

  // Normalize the path to handle redundant separators
  const normalizedName = normalize(entryName);

  // Reject absolute paths
  if (isAbsolute(normalizedName)) {
    return false;
  }

  // Reject paths that resolve to just "." (the installDir itself)
  if (normalizedName === '.') {
    return false;
  }

  // Reject any path containing ".." component
  // Legitimate tarballs never need ".." - all files should be under skill-name/
  // This prevents both system-level escape (../../../etc) and skill-level escape (skill/../other)
  const parts = entryName.split('/');
  for (const part of parts) {
    if (part === '..') {
      return false;
    }
  }

  // Final verification: resolved path must be within installDir.
  // Use path.relative so the check is separator-agnostic (works on Windows '\'
  // and POSIX '/'); a hardcoded '/' rejected every entry on Windows.
  const resolvedInstallDir = resolve(installDir);
  const resolvedEntryPath = resolve(join(installDir, normalizedName));
  const relativePath = relative(resolvedInstallDir, resolvedEntryPath);

  // Entry must be a strict subpath of installDir: non-empty, not escaping via
  // "..", and not an absolute path.
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${sep}`)) {
    return false;
  }
  if (isAbsolute(relativePath)) {
    return false;
  }

  return true;
}

/**
 * Extract a gzipped tarball buffer to the installation directory
 *
 * Expected tarball structure:
 * - skill-name/SKILL.md
 * - skill-name/examples.md
 * - skill-name/scripts/init.sh
 *
 * Extracted directory structure:
 * - installDir/skill-name/SKILL.md
 * - installDir/skill-name/examples.md
 * - installDir/skill-name/scripts/init.sh
 *
 * @param tarball - Gzipped tarball buffer
 * @param installDir - Installation directory path
 *
 * @example
 * await extractTarballBuffer(tarball, '/path/.claude/skills');
 * // Creates: /path/.claude/skills/planning-with-files/SKILL.md
 */
export async function extractTarballBuffer(tarball: Buffer, installDir: string): Promise<void> {
  // Ensure install directory exists
  if (!existsSync(installDir)) {
    mkdirSync(installDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const gunzip = createGunzip();
    const extractor = extract();

    // Process each entry
    extractor.on('entry', (header: Headers, stream, next) => {
      // Security check: validate path is safe (prevents path traversal attacks)
      if (!isPathSafe(installDir, header.name)) {
        // Skip suspicious entries silently
        stream.resume();
        next();
        return;
      }

      const entryPath = join(installDir, normalize(header.name));

      // Handle directory
      if (header.type === 'directory') {
        if (!existsSync(entryPath)) {
          mkdirSync(entryPath, { recursive: true });
        }
        stream.resume();
        next();
        return;
      }

      // Handle file
      if (header.type === 'file') {
        // Ensure parent directory exists
        const parentDir = dirname(entryPath);
        if (!existsSync(parentDir)) {
          mkdirSync(parentDir, { recursive: true });
        }

        // Create write stream
        const writeStream = createWriteStream(entryPath, {
          mode: header.mode,
        });

        // Write file content
        stream.pipe(writeStream);

        writeStream.on('finish', () => {
          next();
        });

        writeStream.on('error', (err) => {
          reject(new Error(`Failed to write file ${entryPath}: ${err.message}`));
        });

        return;
      }

      // Skip other types (e.g., symlinks)
      stream.resume();
      next();
    });

    extractor.on('finish', () => {
      resolve();
    });

    extractor.on('error', (err) => {
      reject(new Error(`Failed to extract tarball: ${err.message}`));
    });

    gunzip.on('error', (err) => {
      reject(new Error(`Failed to decompress tarball: ${err.message}`));
    });

    // Start extraction
    gunzip.pipe(extractor);
    gunzip.end(tarball);
  });
}

/**
 * Get the top-level directory name from a tarball
 *
 * Used to validate tarball structure or get skill name
 *
 * @param tarball - Gzipped tarball buffer
 * @returns Top-level directory name or null if not found
 *
 * @example
 * const skillName = await getTarballTopDir(tarball);
 * // Returns: 'planning-with-files'
 */
export async function getTarballTopDir(tarball: Buffer): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const gunzip = createGunzip();
    const extractor = extract();
    let topDir: string | null = null;

    extractor.on('entry', (header: Headers, stream, next) => {
      if (!topDir && header.name) {
        // Get top-level directory from first entry
        const parts = header.name.split('/');
        if (parts.length > 0 && parts[0]) {
          topDir = parts[0];
        }
      }
      stream.resume();
      next();
    });

    extractor.on('finish', () => {
      resolve(topDir);
    });

    extractor.on('error', (err) => {
      reject(new Error(`Failed to read tarball: ${err.message}`));
    });

    gunzip.on('error', (err) => {
      reject(new Error(`Failed to decompress tarball: ${err.message}`));
    });

    gunzip.pipe(extractor);
    gunzip.end(tarball);
  });
}
