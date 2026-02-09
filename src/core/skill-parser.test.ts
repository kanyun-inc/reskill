import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  discoverSkillsInDir,
  filterSkillsByName,
  parseSkillFromDir,
  parseSkillMd,
  SkillValidationError,
  validateSkillDescription,
  validateSkillName,
} from './skill-parser.js';

describe('skill-parser', () => {
  describe('validateSkillName', () => {
    it('should accept valid lowercase names', () => {
      // Should not throw
      expect(() => validateSkillName('my-skill')).not.toThrow();
      expect(() => validateSkillName('skill123')).not.toThrow();
      expect(() => validateSkillName('a')).not.toThrow();
      expect(() => validateSkillName('my-awesome-skill')).not.toThrow();
      expect(() => validateSkillName('a1b2c3')).not.toThrow();
    });

    it('should reject names with uppercase letters', () => {
      expect(() => validateSkillName('MySkill')).toThrow(SkillValidationError);
      expect(() => validateSkillName('SKILL')).toThrow(SkillValidationError);
      expect(() => validateSkillName('my-Skill')).toThrow(SkillValidationError);
    });

    it('should reject names with invalid characters', () => {
      expect(() => validateSkillName('my_skill')).toThrow(SkillValidationError);
      expect(() => validateSkillName('my.skill')).toThrow(SkillValidationError);
      expect(() => validateSkillName('my skill')).toThrow(SkillValidationError);
      expect(() => validateSkillName('my@skill')).toThrow(SkillValidationError);
    });

    it('should reject empty names', () => {
      expect(() => validateSkillName('')).toThrow(SkillValidationError);
      expect(() => validateSkillName('')).toThrow(/required/i);
    });

    it('should reject names longer than 64 characters', () => {
      const longName = 'a'.repeat(65);
      expect(() => validateSkillName(longName)).toThrow(SkillValidationError);
      expect(() => validateSkillName(longName)).toThrow(/64 characters/i);

      const maxName = 'a'.repeat(64);
      expect(() => validateSkillName(maxName)).not.toThrow();
    });

    it('should reject names starting with hyphen', () => {
      expect(() => validateSkillName('-skill')).toThrow(SkillValidationError);
      expect(() => validateSkillName('-skill')).toThrow(/start with/i);
    });

    it('should reject names ending with hyphen', () => {
      expect(() => validateSkillName('skill-')).toThrow(SkillValidationError);
      expect(() => validateSkillName('skill-')).toThrow(/end with/i);
    });

    it('should reject names with consecutive hyphens', () => {
      expect(() => validateSkillName('my--skill')).toThrow(SkillValidationError);
      expect(() => validateSkillName('my--skill')).toThrow(/consecutive/i);
    });
  });

  describe('validateSkillDescription', () => {
    it('should accept valid descriptions', () => {
      expect(() => validateSkillDescription('A simple skill')).not.toThrow();
      expect(() => validateSkillDescription('This is a skill!')).not.toThrow();
      expect(() => validateSkillDescription('Skill: does things')).not.toThrow();
      expect(() => validateSkillDescription('Test 123')).not.toThrow();
    });

    it('should reject empty descriptions', () => {
      expect(() => validateSkillDescription('')).toThrow(SkillValidationError);
      expect(() => validateSkillDescription('')).toThrow(/required/i);
    });

    it('should accept descriptions with angle brackets (per agentskills.io spec)', () => {
      // Angle brackets are allowed per agentskills.io spec
      expect(() => validateSkillDescription('A <script> skill')).not.toThrow();
      expect(() => validateSkillDescription('Skill > other')).not.toThrow();
      expect(() => validateSkillDescription('<html>')).not.toThrow();
      expect(() => validateSkillDescription('Use <tool> for tasks')).not.toThrow();
      expect(() => validateSkillDescription('Value > 10')).not.toThrow();
    });

    it('should reject descriptions longer than 1024 characters', () => {
      const longDesc = 'a'.repeat(1025);
      expect(() => validateSkillDescription(longDesc)).toThrow(SkillValidationError);
      expect(() => validateSkillDescription(longDesc)).toThrow(/1024 characters/i);

      const maxDesc = 'a'.repeat(1024);
      expect(() => validateSkillDescription(maxDesc)).not.toThrow();
    });
  });

  describe('parseSkillMd', () => {
    it('should parse valid SKILL.md content', () => {
      const content = `---
name: my-skill
description: A test skill
---

# My Skill

This is the skill content.
`;

      const result = parseSkillMd(content);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('my-skill');
      expect(result?.description).toBe('A test skill');
      expect(result?.content).toContain('# My Skill');
      expect(result?.content).toContain('This is the skill content.');
    });

    it('should parse SKILL.md with optional fields', () => {
      const content = `---
name: my-skill
description: A test skill
license: MIT
compatibility: cursor, claude-code
---

Content here.
`;

      const result = parseSkillMd(content);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('my-skill');
      expect(result?.description).toBe('A test skill');
      expect(result?.license).toBe('MIT');
      expect(result?.compatibility).toBe('cursor, claude-code');
    });

    it('should parse SKILL.md with allowed-tools', () => {
      const content = `---
name: my-skill
description: A test skill
allowed-tools: Read Write Shell
---

Content here.
`;

      const result = parseSkillMd(content);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('my-skill');
      expect(result?.allowedTools).toEqual(['Read', 'Write', 'Shell']);
    });

    it('should return null for missing name (non-strict mode)', () => {
      const content = `---
description: A test skill
---

Content here.
`;

      const result = parseSkillMd(content);
      expect(result).toBeNull();
    });

    it('should throw for missing name in strict mode', () => {
      const content = `---
description: A test skill
---

Content here.
`;

      expect(() => parseSkillMd(content, { strict: true })).toThrow(SkillValidationError);
    });

    it('should return null for missing description (non-strict mode)', () => {
      const content = `---
name: my-skill
---

Content here.
`;

      const result = parseSkillMd(content);
      expect(result).toBeNull();
    });

    it('should throw for invalid name format in strict mode', () => {
      const content = `---
name: My-Skill
description: A test skill
---

Content here.
`;

      expect(() => parseSkillMd(content, { strict: true })).toThrow(SkillValidationError);
    });

    it('should return null for missing frontmatter (non-strict mode)', () => {
      const content = `# My Skill

Just content, no frontmatter.
`;

      const result = parseSkillMd(content);
      expect(result).toBeNull();
    });

    it('should preserve raw content', () => {
      const content = `---
name: my-skill
description: A test skill
---

# Header

Some content.
`;

      const result = parseSkillMd(content);
      expect(result).not.toBeNull();
      expect(result?.rawContent).toBe(content);
    });

    it('should handle quoted strings in frontmatter', () => {
      const content = `---
name: "my-skill"
description: "A test skill with: special chars"
---

Content here.
`;

      const result = parseSkillMd(content);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('my-skill');
      expect(result?.description).toBe('A test skill with: special chars');
    });

    it('should handle empty content body', () => {
      const content = `---
name: my-skill
description: A test skill
---
`;

      const result = parseSkillMd(content);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('my-skill');
      expect(result?.content.trim()).toBe('');
    });

    it('should parse top-level version field in frontmatter', () => {
      const content = `---
name: my-skill
description: A test skill
version: "2.4.1"
---

# My Skill

Content.
`;

      const result = parseSkillMd(content);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('my-skill');
      expect(result?.version).toBe('2.4.1');
    });

    it('should parse version without quotes', () => {
      const content = `---
name: my-skill
description: A test skill
version: 1.0.0
---

Content.
`;

      const result = parseSkillMd(content);
      expect(result).not.toBeNull();
      expect(result?.version).toBe('1.0.0');
    });

    it('should prefer top-level version over metadata.version', () => {
      const content = `---
name: my-skill
description: A test skill
version: "2.0.0"
metadata:
  version: "1.0.0"
---

Content.
`;

      const result = parseSkillMd(content);
      expect(result).not.toBeNull();
      // Top-level version should take precedence
      expect(result?.version).toBe('2.0.0');
    });
  });

  describe('parseSkillFromDir', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(path.join(tmpdir(), 'skill-parser-test-'));
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('should parse SKILL.md from directory', () => {
      const skillMd = `---
name: test-skill
description: Test skill from directory
---

# Test Skill

Content.
`;
      writeFileSync(path.join(tempDir, 'SKILL.md'), skillMd);

      const result = parseSkillFromDir(tempDir);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('test-skill');
      expect(result?.description).toBe('Test skill from directory');
    });

    it('should return null if SKILL.md not found (non-strict mode)', () => {
      const result = parseSkillFromDir(tempDir);
      expect(result).toBeNull();
    });

    it('should throw if SKILL.md not found in strict mode', () => {
      expect(() => parseSkillFromDir(tempDir, { strict: true })).toThrow();
    });

    it('should return null if directory does not exist (non-strict mode)', () => {
      const result = parseSkillFromDir('/nonexistent/path');
      expect(result).toBeNull();
    });

    it('should handle nested SKILL.md', () => {
      const nestedDir = path.join(tempDir, 'nested', 'skill');
      mkdirSync(nestedDir, { recursive: true });

      const skillMd = `---
name: nested-skill
description: Nested skill
---

Content.
`;
      writeFileSync(path.join(nestedDir, 'SKILL.md'), skillMd);

      const result = parseSkillFromDir(nestedDir);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('nested-skill');
    });

    it('should include parsed skill with all fields', () => {
      const skillMd = `---
name: complete-skill
description: A complete skill with all fields
license: MIT
compatibility: cursor, claude-code
allowed-tools: Read Write
---

# Complete Skill

This skill has all optional fields.
`;
      writeFileSync(path.join(tempDir, 'SKILL.md'), skillMd);

      const result = parseSkillFromDir(tempDir);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('complete-skill');
      expect(result?.license).toBe('MIT');
      expect(result?.compatibility).toBe('cursor, claude-code');
      expect(result?.allowedTools).toEqual(['Read', 'Write']);
    });
  });

  describe('discoverSkillsInDir', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(path.join(tmpdir(), 'skill-discover-'));
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return empty array when no SKILL.md exists', () => {
      const result = discoverSkillsInDir(tempDir);
      expect(result).toEqual([]);
    });

    it('should discover single skill at root', () => {
      const skillMd = `---
name: root-skill
description: Skill at root
---

Content.
`;
      writeFileSync(path.join(tempDir, 'SKILL.md'), skillMd);
      const result = discoverSkillsInDir(tempDir);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('root-skill');
      expect(result[0].dirPath).toBe(path.resolve(tempDir));
    });

    it('should discover skills in skills/ subdirectory', () => {
      const skillsDir = path.join(tempDir, 'skills');
      mkdirSync(skillsDir, { recursive: true });
      const pdfDir = path.join(skillsDir, 'pdf');
      mkdirSync(pdfDir, { recursive: true });
      writeFileSync(
        path.join(pdfDir, 'SKILL.md'),
        `---
name: pdf
description: PDF skill
---

Content.
`,
      );
      const commitDir = path.join(skillsDir, 'commit');
      mkdirSync(commitDir, { recursive: true });
      writeFileSync(
        path.join(commitDir, 'SKILL.md'),
        `---
name: commit
description: Commit skill
---

Content.
`,
      );
      const result = discoverSkillsInDir(tempDir);
      expect(result).toHaveLength(2);
      const names = result.map((s) => s.name).sort();
      expect(names).toEqual(['commit', 'pdf']);
      expect(result.every((s) => s.dirPath.startsWith(path.resolve(tempDir)))).toBe(true);
    });

    it('should discover skills recursively when not in priority dirs', () => {
      const nestedDir = path.join(tempDir, 'packages', 'a', 'b', 'skill');
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(
        path.join(nestedDir, 'SKILL.md'),
        `---
name: nested-skill
description: Nested
---

Content.
`,
      );
      const result = discoverSkillsInDir(tempDir);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('nested-skill');
      expect(result[0].dirPath).toBe(path.resolve(nestedDir));
    });

    it('should skip node_modules and .git', () => {
      const skipDir = path.join(tempDir, 'node_modules', 'some-pkg');
      mkdirSync(skipDir, { recursive: true });
      writeFileSync(
        path.join(skipDir, 'SKILL.md'),
        `---
name: ignored
description: Should be ignored
---

Content.
`,
      );
      const result = discoverSkillsInDir(tempDir);
      expect(result).toHaveLength(0);
    });

    it('should deduplicate by skill name', () => {
      writeFileSync(
        path.join(tempDir, 'SKILL.md'),
        `---
name: same-name
description: Root
---

Root.
`,
      );
      const skillsDir = path.join(tempDir, 'skills', 'dup');
      mkdirSync(skillsDir, { recursive: true });
      writeFileSync(
        path.join(skillsDir, 'SKILL.md'),
        `---
name: same-name
description: Duplicate name
---

Dup.
`,
      );
      const result = discoverSkillsInDir(tempDir);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('same-name');
    });
  });

  describe('filterSkillsByName', () => {
    it('should return empty when no names given', () => {
      const skills = [
        { name: 'pdf', description: 'x', content: '', rawContent: '', dirPath: '/a/pdf' },
      ] as Parameters<typeof filterSkillsByName>[0];
      expect(filterSkillsByName(skills, [])).toEqual([]);
    });

    it('should filter by single name (case-insensitive)', () => {
      const skills = [
        { name: 'pdf', description: 'x', content: '', rawContent: '', dirPath: '/a/pdf' },
        { name: 'commit', description: 'x', content: '', rawContent: '', dirPath: '/a/commit' },
      ] as Parameters<typeof filterSkillsByName>[0];
      expect(filterSkillsByName(skills, ['PDF'])).toHaveLength(1);
      expect(filterSkillsByName(skills, ['PDF'])[0].name).toBe('pdf');
      expect(filterSkillsByName(skills, ['commit'])).toHaveLength(1);
      expect(filterSkillsByName(skills, ['commit'])[0].name).toBe('commit');
    });

    it('should filter by multiple names', () => {
      const skills = [
        { name: 'pdf', description: 'x', content: '', rawContent: '', dirPath: '/a/pdf' },
        { name: 'commit', description: 'x', content: '', rawContent: '', dirPath: '/a/commit' },
        { name: 'pr-review', description: 'x', content: '', rawContent: '', dirPath: '/a/pr' },
      ] as Parameters<typeof filterSkillsByName>[0];
      const filtered = filterSkillsByName(skills, ['pdf', 'pr-review']);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((s) => s.name).sort()).toEqual(['pdf', 'pr-review']);
    });

    it('should return empty when no names match', () => {
      const skills = [
        { name: 'pdf', description: 'x', content: '', rawContent: '', dirPath: '/a/pdf' },
      ] as Parameters<typeof filterSkillsByName>[0];
      expect(filterSkillsByName(skills, ['nonexistent'])).toEqual([]);
    });
  });

  describe('SkillValidationError', () => {
    it('should have correct name property', () => {
      const error = new SkillValidationError('test error');
      expect(error.name).toBe('SkillValidationError');
    });

    it('should have field property when provided', () => {
      const error = new SkillValidationError('test error', 'name');
      expect(error.field).toBe('name');
    });

    it('should have message property', () => {
      const error = new SkillValidationError('test error message');
      expect(error.message).toBe('test error message');
    });
  });
});
