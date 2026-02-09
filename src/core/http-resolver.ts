import * as path from 'node:path';
import type { ParsedSkillRef, ParsedVersion } from '../types/index.js';
import type { ArchiveFormat } from '../utils/http.js';

/**
 * Parsed HTTP/OSS URL information
 */
export interface ParsedHttpUrl {
  /** Full URL */
  url: string;
  /** Host name (e.g., bucket.oss-cn-hangzhou.aliyuncs.com) */
  host: string;
  /** Path after host */
  path: string;
  /** Filename from URL */
  filename: string;
  /** Archive format if detected */
  format?: ArchiveFormat;
  /** Extracted skill name */
  skillName: string;
  /** Version extracted from URL or filename */
  version?: string;
}

/**
 * HttpResolver - Parse HTTP/OSS URLs and resolve skill references
 *
 * Supported URL formats:
 *   - https://bucket.oss-cn-hangzhou.aliyuncs.com/path/to/skill.tar.gz
 *   - https://bucket.s3.amazonaws.com/skills/skill-v1.0.0.tar.gz
 *   - https://example.com/skills/my-skill.zip
 *   - http://localhost:8080/skills/test-skill.tar.gz
 *
 * The resolver extracts:
 *   - Skill name from filename (removes version suffix and archive extension)
 *   - Version from filename pattern (e.g., skill-v1.0.0.tar.gz -> v1.0.0)
 *   - Archive format for extraction
 */
export class HttpResolver {
  /**
   * Check if a reference is an HTTP/OSS URL (for archive downloads)
   *
   * Returns true for:
   * - http:// or https:// URLs with archive file extensions (.tar.gz, .tgz, .zip, .tar)
   * - Explicit oss:// or s3:// protocol URLs (always treated as archive sources)
   *
   * Returns false for:
   * - Git repository URLs (*.git)
   * - GitHub/GitLab web URLs (/tree/, /blob/, /raw/)
   * - Bare HTTPS repo URLs without archive extensions (e.g., https://github.com/user/repo)
   *   These are treated as Git references and handled by GitResolver.
   */
  static isHttpUrl(ref: string): boolean {
    // Remove version suffix for checking (e.g., url@v1.0.0)
    const urlPart = ref.split('@')[0];

    // oss:// and s3:// are always archive download sources
    if (urlPart.startsWith('oss://') || urlPart.startsWith('s3://')) {
      return true;
    }

    // For http:// and https:// URLs, distinguish between Git repos and archive downloads
    if (urlPart.startsWith('http://') || urlPart.startsWith('https://')) {
      // Exclude Git repository URLs (ending with .git)
      if (urlPart.endsWith('.git')) {
        return false;
      }

      // Exclude GitHub/GitLab web URLs (containing /tree/, /blob/, /raw/)
      if (/\/(tree|blob|raw)\//.test(urlPart)) {
        return false;
      }

      // Only classify as HTTP archive if URL has a recognized archive extension.
      // Bare HTTPS URLs like https://github.com/user/repo are Git references,
      // not archive downloads, and should fall through to GitResolver.
      return /\.(tar\.gz|tgz|zip|tar)$/i.test(urlPart);
    }

    return false;
  }

  /**
   * Parse an HTTP/OSS URL reference
   *
   * Supported formats:
   * - https://host/path/to/skill-v1.0.0.tar.gz
   * - https://host/path/to/skill.tar.gz@v1.0.0
   * - oss://bucket/path/to/skill.tar.gz
   */
  parseUrl(ref: string): ParsedHttpUrl {
    let url = ref;
    let explicitVersion: string | undefined;

    // Extract explicit version suffix (@v1.0.0)
    const atIndex = ref.lastIndexOf('@');
    if (atIndex > 0 && !ref.slice(atIndex).includes('/')) {
      explicitVersion = ref.slice(atIndex + 1);
      url = ref.slice(0, atIndex);
    }

    // Normalize protocol
    url = this.normalizeUrl(url);

    // Parse URL components
    const urlObj = new URL(url);
    const host = urlObj.host;
    const urlPath = urlObj.pathname;
    const filename = path.basename(urlPath);

    // Detect archive format
    const format = this.detectArchiveFormat(filename);

    // Extract skill name and version from filename
    const { name, version: filenameVersion } = this.parseFilename(filename);
    const skillName = name;
    const version = explicitVersion || filenameVersion;

    return {
      url,
      host,
      path: urlPath,
      filename,
      format,
      skillName,
      version,
    };
  }

  /**
   * Parse HTTP URL to ParsedSkillRef format (for compatibility with existing system)
   */
  parseRef(ref: string): ParsedSkillRef {
    const parsed = this.parseUrl(ref);

    // Use host as registry, 'http' as owner (convention for HTTP sources)
    return {
      registry: 'http',
      owner: parsed.host,
      repo: parsed.skillName,
      version: parsed.version,
      raw: ref,
    };
  }

  /**
   * Parse version specification (same as GitResolver for consistency)
   */
  parseVersion(versionSpec?: string): ParsedVersion {
    if (!versionSpec) {
      return { type: 'exact', value: 'latest', raw: '' };
    }

    const raw = versionSpec;

    // latest
    if (versionSpec === 'latest') {
      return { type: 'latest', value: 'latest', raw };
    }

    // exact version (v1.0.0 or 1.0.0)
    return { type: 'exact', value: versionSpec, raw };
  }

  /**
   * Resolve version for HTTP sources
   * Since HTTP sources are static, we just return the parsed version
   */
  async resolveVersion(
    _url: string,
    versionSpec: ParsedVersion,
  ): Promise<{ ref: string; commit?: string }> {
    // For HTTP sources, version is embedded in URL or specified explicitly
    // No remote version resolution like Git
    return { ref: versionSpec.value };
  }

  /**
   * Build the download URL
   * For HTTP sources, the URL is already complete
   */
  buildRepoUrl(parsed: ParsedSkillRef): string {
    // For HTTP sources, raw contains the full URL
    const urlPart = parsed.raw.split('@')[0];
    return this.normalizeUrl(urlPart);
  }

  /**
   * Full resolution: from reference string to download-ready information
   */
  async resolve(ref: string): Promise<{
    parsed: ParsedSkillRef;
    repoUrl: string;
    ref: string;
    commit?: string;
    httpInfo: ParsedHttpUrl;
  }> {
    const httpInfo = this.parseUrl(ref);
    const parsed = this.parseRef(ref);
    const repoUrl = httpInfo.url;
    const versionSpec = this.parseVersion(parsed.version);
    const resolved = await this.resolveVersion(repoUrl, versionSpec);

    return {
      parsed,
      repoUrl,
      ref: resolved.ref,
      commit: resolved.commit,
      httpInfo,
    };
  }

  /**
   * Normalize URL protocol
   * Converts oss:// and s3:// to https://
   */
  private normalizeUrl(url: string): string {
    // Convert oss:// to https:// (Aliyun OSS)
    if (url.startsWith('oss://')) {
      // oss://bucket-name/path -> https://bucket-name.oss.aliyuncs.com/path
      const parts = url.slice(6).split('/');
      const bucket = parts[0];
      const rest = parts.slice(1).join('/');
      return `https://${bucket}.oss.aliyuncs.com/${rest}`;
    }

    // Convert s3:// to https:// (AWS S3)
    if (url.startsWith('s3://')) {
      // s3://bucket-name/path -> https://bucket-name.s3.amazonaws.com/path
      const parts = url.slice(5).split('/');
      const bucket = parts[0];
      const rest = parts.slice(1).join('/');
      return `https://${bucket}.s3.amazonaws.com/${rest}`;
    }

    return url;
  }

  /**
   * Detect archive format from filename
   */
  private detectArchiveFormat(filename: string): ArchiveFormat | undefined {
    const lower = filename.toLowerCase();

    if (lower.endsWith('.tar.gz')) return 'tar.gz';
    if (lower.endsWith('.tgz')) return 'tgz';
    if (lower.endsWith('.zip')) return 'zip';
    if (lower.endsWith('.tar')) return 'tar';

    return undefined;
  }

  /**
   * Parse filename to extract skill name and version
   *
   * Examples:
   * - my-skill-v1.0.0.tar.gz -> { name: 'my-skill', version: 'v1.0.0' }
   * - skill.tar.gz -> { name: 'skill', version: undefined }
   * - test-skill-1.2.3.zip -> { name: 'test-skill', version: '1.2.3' }
   */
  private parseFilename(filename: string): { name: string; version?: string } {
    // Remove archive extension
    const baseName = filename
      .replace(/\.tar\.gz$/i, '')
      .replace(/\.tgz$/i, '')
      .replace(/\.zip$/i, '')
      .replace(/\.tar$/i, '');

    // Try to extract version pattern
    // Patterns: -v1.0.0, -1.0.0, _v1.0.0, _1.0.0
    const versionMatch = baseName.match(/[-_](v?\d+\.\d+\.\d+(?:-[\w.]+)?)$/i);

    if (versionMatch) {
      const version = versionMatch[1];
      const name = baseName.slice(0, -versionMatch[0].length);
      return { name, version };
    }

    return { name: baseName };
  }
}
