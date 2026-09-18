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
import { logger } from '../utils/logger.js';

/**
 * Check if a tarball entry is a macOS/Windows metadata artifact that should be ignored
 *
 * Covers:
 * - AppleDouble files (`._foo`) — created by macOS tar/zip when packing from
 *   volumes with extended attributes; bsdtar writes `._<dir>` as the FIRST
 *   entry before the real directory, which broke top-dir detection (#3062)
 * - `__MACOSX/` directories — zip metadata folders created by macOS Archive
 *   Utility / Finder compress
 * - `.DS_Store` — Finder directory metadata
 *
 * @param entryName - Entry name from tarball header
 * @returns true if the entry is metadata junk
 *
 * @example
 * isMacMetadataPath('._pptx')            // true
 * isMacMetadataPath('__MACOSX/pptx/._.') // true
 * isMacMetadataPath('pptx/._SKILL.md')   // true
 * isMacMetadataPath('pptx/SKILL.md')     // false
 */
export function isMacMetadataPath(entryName: string): boolean {
  if (!entryName) {
    return false;
  }

  const parts = entryName.split(/[\\/]/);
  for (const part of parts) {
    if (part === '__MACOSX' || part === '.DS_Store' || part.startsWith('._')) {
      return true;
    }
  }
  return false;
}

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
  // Split on the platform separators: on Windows both '\' and '/' are separators,
  // so a '..' hidden behind a backslash (skill\..\other) must also be caught. On
  // POSIX, '\' is a valid filename character and must not be treated as a separator.
  const separatorPattern = sep === '\\' ? /[\\/]/ : /\//;
  const parts = entryName.split(separatorPattern);
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
      // Skip macOS/Windows metadata entries (._foo, __MACOSX/, .DS_Store).
      // They carry no skill content and a leading ._<dir> file previously
      // poisoned top-dir detection (#3062).
      if (isMacMetadataPath(header.name)) {
        stream.resume();
        next();
        return;
      }

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
 * Metadata entries (`._foo`, `__MACOSX/`, `.DS_Store`) are ignored: on macOS
 * a leading `._<skill>` AppleDouble file used to be mistaken for the skill
 * root even though it is a plain file, breaking downstream installs with
 * ENOTDIR (#3062).
 *
 * Detection order:
 * 1. The top-level directory that directly contains a `SKILL.md`
 * 2. `null` if a flat tarball has `SKILL.md` at the root (caller should use
 *    the extraction directory itself as the skill directory)
 * 3. Otherwise the first path segment of the first non-metadata entry
 *
 * @param tarball - Gzipped tarball buffer
 * @returns Top-level directory name, or null if not found / flat layout
 *
 * @example
 * const skillName = await getTarballTopDir(tarball);
 * // Returns: 'planning-with-files'
 */
export async function getTarballTopDir(tarball: Buffer): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const gunzip = createGunzip();
    const extractor = extract();
    let firstTopDir: string | null = null;
    let skillTopDir: string | null = null;
    let flatSkillMd = false;
    const skillMdCandidates = new Set<string>();

    extractor.on('entry', (header: Headers, stream, next) => {
      if (header.name && !isMacMetadataPath(header.name)) {
        // Split on platform separators: normalize() turns '/' into '\' on
        // Windows, so both must be treated as separators there.
        const separatorPattern = sep === '\\' ? /[\\/]/ : /\//;
        const parts = normalize(header.name).split(separatorPattern).filter(Boolean);
        const top = parts[0];
        if (top) {
          if (firstTopDir === null) {
            firstTopDir = top;
          }
          // A SKILL.md directly inside the top dir marks the real skill root
          if (parts.length === 2 && parts[1].toLowerCase() === 'skill.md') {
            skillMdCandidates.add(top);
            if (skillTopDir === null) {
              skillTopDir = top;
            }
          }
          // Flat layout: SKILL.md at tarball root means no top-level dir
          if (parts.length === 1 && top.toLowerCase() === 'skill.md') {
            flatSkillMd = true;
          }
        }
      }
      stream.resume();
      next();
    });

    extractor.on('finish', () => {
      // Registry tarballs are single-skill by contract. If several top-level
      // directories each contain a SKILL.md, the first one wins — but that is
      // again "tarball order decides semantics", so leave a signal instead of
      // failing silently.
      if (skillMdCandidates.size > 1) {
        logger.warn(
          `Tarball contains multiple SKILL.md roots ([${Array.from(skillMdCandidates).join(', ')}]); using the first: ${skillTopDir}`,
        );
      }
      resolve(skillTopDir ?? (flatSkillMd ? null : firstTopDir));
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
