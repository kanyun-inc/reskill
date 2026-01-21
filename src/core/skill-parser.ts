/**
 * Skill Parser - SKILL.md 解析器
 *
 * 遵循 agentskills.io 规范: https://agentskills.io/specification
 *
 * SKILL.md 格式要求:
 * - YAML frontmatter 包含 name 和 description (必填)
 * - name: 最多 64 字符，小写字母、数字、连字符
 * - description: 最多 1024 字符
 * - 可选字段: license, compatibility, metadata, allowed-tools
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * SKILL.md frontmatter 原始数据
 */
export interface SkillMdFrontmatter {
  /** Skill 名称 (必填) - 小写字母、数字、连字符 */
  name: string;
  /** Skill 描述 (必填) */
  description: string;
  /** 许可证 */
  license?: string;
  /** 兼容性要求 */
  compatibility?: string;
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
  /** 允许使用的工具列表 (空格分隔) */
  'allowed-tools'?: string;
}

/**
 * 解析后的 Skill 信息
 */
export interface ParsedSkill {
  /** Skill 名称 */
  name: string;
  /** Skill 描述 */
  description: string;
  /** 许可证 */
  license?: string;
  /** 兼容性要求 */
  compatibility?: string;
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
  /** 允许使用的工具列表 */
  allowedTools?: string[];
  /** Markdown 内容 (不含 frontmatter) */
  content: string;
  /** 原始完整内容 */
  rawContent: string;
}

/**
 * Skill 验证错误
 */
export class SkillValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'SkillValidationError';
  }
}

/**
 * 简单的 YAML frontmatter 解析器
 * 解析 --- 分隔的 YAML 头部
 */
function parseFrontmatter(content: string): {
  data: Record<string, unknown>;
  content: string;
} {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { data: {}, content };
  }

  const yamlContent = match[1];
  const markdownContent = match[2];

  // 简单的 YAML 解析 (支持基本的 key: value 格式)
  const data: Record<string, unknown> = {};
  const lines = yamlContent.split('\n');
  let currentKey = '';
  let currentValue = '';
  let inMultiline = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    // 检查是否是新的 key: value 对
    const keyValueMatch = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);

    if (keyValueMatch && !inMultiline) {
      // 保存之前的值
      if (currentKey) {
        data[currentKey] = parseYamlValue(currentValue.trim());
      }

      currentKey = keyValueMatch[1];
      currentValue = keyValueMatch[2];

      // 检查是否是多行字符串开始
      if (currentValue === '|' || currentValue === '>') {
        inMultiline = true;
        currentValue = '';
      }
    } else if (inMultiline && line.startsWith('  ')) {
      // 多行字符串续行
      currentValue += (currentValue ? '\n' : '') + line.slice(2);
    } else if (inMultiline && !line.startsWith('  ')) {
      // 多行字符串结束
      inMultiline = false;
      data[currentKey] = currentValue.trim();

      // 尝试解析新行
      const newKeyMatch = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
      if (newKeyMatch) {
        currentKey = newKeyMatch[1];
        currentValue = newKeyMatch[2];
      }
    }
  }

  // 保存最后一个值
  if (currentKey) {
    data[currentKey] = parseYamlValue(currentValue.trim());
  }

  return { data, content: markdownContent };
}

/**
 * 解析 YAML 值
 */
function parseYamlValue(value: string): unknown {
  if (!value) return '';

  // 布尔值
  if (value === 'true') return true;
  if (value === 'false') return false;

  // 数字
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);

  // 移除引号
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

/**
 * 验证 skill name 格式
 *
 * 规范要求:
 * - 最多 64 字符
 * - 只能包含小写字母、数字、连字符
 * - 不能以连字符开头或结尾
 * - 不能包含连续连字符
 */
export function validateSkillName(name: string): void {
  if (!name) {
    throw new SkillValidationError('Skill name is required', 'name');
  }

  if (name.length > 64) {
    throw new SkillValidationError(
      'Skill name must be at most 64 characters',
      'name'
    );
  }

  if (!/^[a-z0-9]/.test(name)) {
    throw new SkillValidationError(
      'Skill name must start with a lowercase letter or number',
      'name'
    );
  }

  if (!/[a-z0-9]$/.test(name)) {
    throw new SkillValidationError(
      'Skill name must end with a lowercase letter or number',
      'name'
    );
  }

  if (/--/.test(name)) {
    throw new SkillValidationError(
      'Skill name cannot contain consecutive hyphens',
      'name'
    );
  }

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name) && name.length > 1) {
    throw new SkillValidationError(
      'Skill name can only contain lowercase letters, numbers, and hyphens',
      'name'
    );
  }

  // 单字符名称
  if (name.length === 1 && !/^[a-z0-9]$/.test(name)) {
    throw new SkillValidationError(
      'Single character skill name must be a lowercase letter or number',
      'name'
    );
  }
}

/**
 * 验证 skill description
 *
 * 规范要求:
 * - 最多 1024 字符
 * - 不能包含尖括号
 */
export function validateSkillDescription(description: string): void {
  if (!description) {
    throw new SkillValidationError(
      'Skill description is required',
      'description'
    );
  }

  if (description.length > 1024) {
    throw new SkillValidationError(
      'Skill description must be at most 1024 characters',
      'description'
    );
  }

  if (/<|>/.test(description)) {
    throw new SkillValidationError(
      'Skill description cannot contain angle brackets',
      'description'
    );
  }
}

/**
 * 解析 SKILL.md 内容
 *
 * @param content - SKILL.md 文件内容
 * @param options - 解析选项
 * @returns 解析后的 skill 信息，如果格式无效则返回 null
 * @throws SkillValidationError 如果 strict 模式下验证失败
 */
export function parseSkillMd(
  content: string,
  options: { strict?: boolean } = {}
): ParsedSkill | null {
  const { strict = false } = options;

  try {
    const { data, content: body } = parseFrontmatter(content);

    // 检查必填字段
    if (!data.name || !data.description) {
      if (strict) {
        throw new SkillValidationError(
          'SKILL.md must have name and description in frontmatter'
        );
      }
      return null;
    }

    const name = String(data.name);
    const description = String(data.description);

    // 验证字段格式
    if (strict) {
      validateSkillName(name);
      validateSkillDescription(description);
    }

    // 解析 allowed-tools
    let allowedTools: string[] | undefined;
    if (data['allowed-tools']) {
      const toolsStr = String(data['allowed-tools']);
      allowedTools = toolsStr.split(/\s+/).filter(Boolean);
    }

    return {
      name,
      description,
      license: data.license ? String(data.license) : undefined,
      compatibility: data.compatibility ? String(data.compatibility) : undefined,
      metadata: data.metadata as Record<string, unknown> | undefined,
      allowedTools,
      content: body,
      rawContent: content,
    };
  } catch (error) {
    if (error instanceof SkillValidationError) {
      throw error;
    }
    if (strict) {
      throw new SkillValidationError(`Failed to parse SKILL.md: ${error}`);
    }
    return null;
  }
}

/**
 * 从文件路径解析 SKILL.md
 */
export function parseSkillMdFile(
  filePath: string,
  options: { strict?: boolean } = {}
): ParsedSkill | null {
  if (!fs.existsSync(filePath)) {
    if (options.strict) {
      throw new SkillValidationError(`SKILL.md not found: ${filePath}`);
    }
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return parseSkillMd(content, options);
}

/**
 * 从 skill 目录解析 SKILL.md
 */
export function parseSkillFromDir(
  dirPath: string,
  options: { strict?: boolean } = {}
): ParsedSkill | null {
  const skillMdPath = path.join(dirPath, 'SKILL.md');
  return parseSkillMdFile(skillMdPath, options);
}

/**
 * 检查目录是否包含有效的 SKILL.md
 */
export function hasValidSkillMd(dirPath: string): boolean {
  const skillMdPath = path.join(dirPath, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    return false;
  }

  try {
    const skill = parseSkillMdFile(skillMdPath);
    return skill !== null;
  } catch {
    return false;
  }
}

/**
 * 生成 SKILL.md 内容
 */
export function generateSkillMd(
  skill: Omit<ParsedSkill, 'rawContent'>
): string {
  const frontmatter: string[] = ['---'];

  frontmatter.push(`name: ${skill.name}`);
  frontmatter.push(`description: ${skill.description}`);

  if (skill.license) {
    frontmatter.push(`license: ${skill.license}`);
  }

  if (skill.compatibility) {
    frontmatter.push(`compatibility: ${skill.compatibility}`);
  }

  if (skill.allowedTools && skill.allowedTools.length > 0) {
    frontmatter.push(`allowed-tools: ${skill.allowedTools.join(' ')}`);
  }

  frontmatter.push('---');
  frontmatter.push('');

  return frontmatter.join('\n') + skill.content;
}

export default {
  parseSkillMd,
  parseSkillMdFile,
  parseSkillFromDir,
  hasValidSkillMd,
  validateSkillName,
  validateSkillDescription,
  generateSkillMd,
};
