import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import {
  parseSkillMd,
  parseSkillFromDir,
  validateSkillName,
  validateSkillDescription,
  SkillValidationError,
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

    it('should reject descriptions with angle brackets', () => {
      expect(() => validateSkillDescription('A <script> skill')).toThrow(
        SkillValidationError
      );
      expect(() => validateSkillDescription('Skill > other')).toThrow(
        SkillValidationError
      );
      expect(() => validateSkillDescription('<html>')).toThrow(SkillValidationError);
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
      expect(result!.name).toBe('my-skill');
      expect(result!.description).toBe('A test skill');
      expect(result!.content).toContain('# My Skill');
      expect(result!.content).toContain('This is the skill content.');
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
      expect(result!.name).toBe('my-skill');
      expect(result!.description).toBe('A test skill');
      expect(result!.license).toBe('MIT');
      expect(result!.compatibility).toBe('cursor, claude-code');
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
      expect(result!.name).toBe('my-skill');
      expect(result!.allowedTools).toEqual(['Read', 'Write', 'Shell']);
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

      expect(() => parseSkillMd(content, { strict: true })).toThrow(
        SkillValidationError
      );
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

      expect(() => parseSkillMd(content, { strict: true })).toThrow(
        SkillValidationError
      );
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
      expect(result!.rawContent).toBe(content);
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
      expect(result!.name).toBe('my-skill');
      expect(result!.description).toBe('A test skill with: special chars');
    });

    it('should handle empty content body', () => {
      const content = `---
name: my-skill
description: A test skill
---
`;

      const result = parseSkillMd(content);
      expect(result).not.toBeNull();
      expect(result!.name).toBe('my-skill');
      expect(result!.content.trim()).toBe('');
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
      expect(result!.name).toBe('test-skill');
      expect(result!.description).toBe('Test skill from directory');
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
      expect(result!.name).toBe('nested-skill');
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
      expect(result!.name).toBe('complete-skill');
      expect(result!.license).toBe('MIT');
      expect(result!.compatibility).toBe('cursor, claude-code');
      expect(result!.allowedTools).toEqual(['Read', 'Write']);
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
