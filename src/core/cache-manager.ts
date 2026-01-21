import * as path from 'node:path';
import type { ParsedSkillRef } from '../types/index.js';
import {
  exists,
  ensureDir,
  remove,
  copyDir,
  listDir,
  isDirectory,
  getCacheDir,
} from '../utils/fs.js';
import { clone, getCurrentCommit } from '../utils/git.js';

/**
 * CacheManager - 管理全局 skill 缓存
 * 
 * 缓存目录结构:
 * ~/.reskill-cache/
 * ├── github/                          # 简写格式的 registry
 * │   └── user/
 * │       └── skill/
 * │           ├── v1.0.0/
 * │           └── v1.1.0/
 * ├── github.com/                      # Git URL 格式，使用 host 作为目录
 * │   └── user/
 * │       └── private-skill/
 * │           └── v1.0.0/
 * └── gitlab.company.com/              # 私有 GitLab 实例
 *     └── team/
 *         └── skill/
 *             └── v2.0.0/
 * 
 * 对于 Git URL 格式 (SSH/HTTPS):
 * - git@github.com:user/repo.git -> github.com/user/repo/version
 * - https://gitlab.company.com/team/skill.git -> gitlab.company.com/team/skill/version
 */
export class CacheManager {
  private cacheDir: string;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || getCacheDir();
  }

  /**
   * 获取缓存目录
   */
  getCacheDir(): string {
    return this.cacheDir;
  }

  /**
   * 获取 skill 在缓存中的路径
   * 
   * 对于不同的引用格式，缓存路径如下:
   * - github:user/repo@v1.0.0 -> ~/.reskill-cache/github/user/repo/v1.0.0
   * - git@github.com:user/repo.git@v1.0.0 -> ~/.reskill-cache/github.com/user/repo/v1.0.0
   * - https://gitlab.company.com/team/skill.git@v2.0.0 -> ~/.reskill-cache/gitlab.company.com/team/skill/v2.0.0
   */
  getSkillCachePath(parsed: ParsedSkillRef, version: string): string {
    return path.join(
      this.cacheDir,
      parsed.registry,
      parsed.owner,
      parsed.repo,
      version
    );
  }

  /**
   * 获取缓存路径 (getSkillCachePath 的别名)
   */
  getCachePath(parsed: ParsedSkillRef, version: string): string {
    return this.getSkillCachePath(parsed, version);
  }

  /**
   * 检查 skill 是否已缓存
   */
  isCached(parsed: ParsedSkillRef, version: string): boolean {
    const cachePath = this.getSkillCachePath(parsed, version);
    return exists(cachePath) && isDirectory(cachePath);
  }

  /**
   * 获取缓存的 skill
   */
  async get(
    parsed: ParsedSkillRef,
    version: string
  ): Promise<{ path: string; commit: string } | null> {
    const cachePath = this.getSkillCachePath(parsed, version);
    
    if (!this.isCached(parsed, version)) {
      return null;
    }

    // 读取缓存的 commit 信息
    const commitFile = path.join(cachePath, '.reskill-commit');
    let commit = '';
    
    try {
      const fs = await import('node:fs');
      if (exists(commitFile)) {
        commit = fs.readFileSync(commitFile, 'utf-8').trim();
      }
    } catch {
      // 忽略读取错误
    }

    return { path: cachePath, commit };
  }

  /**
   * 缓存 skill
   */
  async cache(
    repoUrl: string,
    parsed: ParsedSkillRef,
    ref: string,
    version: string
  ): Promise<{ path: string; commit: string }> {
    const cachePath = this.getSkillCachePath(parsed, version);
    
    // 如果已存在，先删除
    if (exists(cachePath)) {
      remove(cachePath);
    }

    ensureDir(path.dirname(cachePath));

    // 克隆仓库
    const tempPath = `${cachePath}.tmp`;
    remove(tempPath);

    await clone(repoUrl, tempPath, { depth: 1, branch: ref });

    // 获取 commit hash
    const commit = await getCurrentCommit(tempPath);

    // 如果有 subPath，只保留子目录
    if (parsed.subPath) {
      const subDir = path.join(tempPath, parsed.subPath);
      if (!exists(subDir)) {
        remove(tempPath);
        throw new Error(`Subpath ${parsed.subPath} not found in repository`);
      }
      copyDir(subDir, cachePath, { exclude: ['.git'] });
    } else {
      copyDir(tempPath, cachePath, { exclude: ['.git'] });
    }

    // 保存 commit 信息
    const fs = await import('node:fs');
    fs.writeFileSync(path.join(cachePath, '.reskill-commit'), commit);

    // 清理临时目录
    remove(tempPath);

    return { path: cachePath, commit };
  }

  /**
   * 从缓存复制到目标目录
   */
  async copyTo(
    parsed: ParsedSkillRef,
    version: string,
    destPath: string
  ): Promise<void> {
    const cached = await this.get(parsed, version);
    
    if (!cached) {
      throw new Error(`Skill ${parsed.raw} version ${version} not found in cache`);
    }

    // 如果目标存在，先删除
    if (exists(destPath)) {
      remove(destPath);
    }

    copyDir(cached.path, destPath, { exclude: ['.reskill-commit'] });
  }

  /**
   * 清理特定 skill 的缓存
   */
  clearSkill(parsed: ParsedSkillRef, version?: string): void {
    if (version) {
      const cachePath = this.getSkillCachePath(parsed, version);
      remove(cachePath);
    } else {
      // 清理所有版本
      const skillDir = path.join(
        this.cacheDir,
        parsed.registry,
        parsed.owner,
        parsed.repo
      );
      remove(skillDir);
    }
  }

  /**
   * 清理所有缓存
   */
  clearAll(): void {
    remove(this.cacheDir);
  }

  /**
   * 获取缓存统计
   */
  getStats(): { totalSkills: number; registries: string[] } {
    if (!exists(this.cacheDir)) {
      return { totalSkills: 0, registries: [] };
    }

    const registries = listDir(this.cacheDir).filter(name =>
      isDirectory(path.join(this.cacheDir, name))
    );

    let totalSkills = 0;

    for (const registry of registries) {
      const registryPath = path.join(this.cacheDir, registry);
      const owners = listDir(registryPath).filter(name =>
        isDirectory(path.join(registryPath, name))
      );

      for (const owner of owners) {
        const ownerPath = path.join(registryPath, owner);
        const repos = listDir(ownerPath).filter(name =>
          isDirectory(path.join(ownerPath, name))
        );
        totalSkills += repos.length;
      }
    }

    return { totalSkills, registries };
  }
}

export default CacheManager;
