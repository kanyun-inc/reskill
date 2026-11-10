#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const SOURCE_README = 'README.md';

/**
 * Run a git command safely using execFileSync (no shell interpretation).
 * Returns stdout trimmed, or '' on any failure.
 */
function runGit(...args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (error) {
    if (process.env.DEBUG) {
      console.error(`[readme-sync] git command failed: git ${args.join(' ')}`, error.message);
    }
    return '';
  }
}

function parseChangedFiles(output) {
  if (!output) {
    return [];
  }
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function getLocalizedReadmes() {
  return readdirSync('.')
    .filter(
      (name) =>
        name.startsWith('README.') &&
        name.endsWith('.md') &&
        name !== SOURCE_README,
    )
    .sort();
}

function getChangedFiles() {
  const cliFiles = process.argv
    .slice(2)
    .map((file) => file.trim())
    .filter(Boolean);
  if (cliFiles.length > 0) {
    return cliFiles;
  }

  const staged = parseChangedFiles(runGit('diff', '--name-only', '--cached'));
  if (staged.length > 0) {
    return staged;
  }

  if (process.env.CI === 'true') {
    const baseBranch = process.env.GITHUB_BASE_REF ?? 'main';
    if (!/^[a-zA-Z0-9._\/-]+$/.test(baseBranch)) {
      console.error(`[readme-sync] Invalid base branch name: ${baseBranch}, skipping CI diff.`);
    } else {
      const mergeBase = runGit('merge-base', 'HEAD', `origin/${baseBranch}`);
      if (mergeBase) {
        const ciDiff = parseChangedFiles(
          runGit('diff', '--name-only', `${mergeBase}..HEAD`),
        );
        if (ciDiff.length > 0) {
          return ciDiff;
        }
      }
    }
  }

  // Fallback: compare against the previous commit only. This may miss changes
  // spread across multiple commits in a PR branch. CI uses merge-base above
  // for accurate full-PR comparison; this path is mainly for local convenience.
  return parseChangedFiles(runGit('diff', '--name-only', 'HEAD~1..HEAD'));
}

function main() {
  const localizedReadmes = getLocalizedReadmes();
  if (localizedReadmes.length === 0) {
    console.log('[readme-sync] No localized README files found, skipping.');
    return;
  }

  const changedFiles = getChangedFiles();
  const changedSet = new Set(changedFiles);
  if (!changedSet.has(SOURCE_README)) {
    console.log('[readme-sync] README.md unchanged, skipping.');
    return;
  }

  const missingReadmes = localizedReadmes.filter((file) => !changedSet.has(file));
  if (missingReadmes.length > 0) {
    console.error(
      `[readme-sync] README.md changed, but these localized README files were not updated: ${missingReadmes.join(', ')}`,
    );
    console.error(
      '[readme-sync] Update these files or include an explicit reason in your PR description before merging.',
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `[readme-sync] README sync check passed for: ${localizedReadmes.join(', ')}`,
  );
}

main();
