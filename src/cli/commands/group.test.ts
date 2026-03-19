/**
 * group command unit tests
 *
 * Tests for helper functions: normalizeGroupPath and generateSlug
 */

import { describe, expect, it } from 'vitest';
import groupCommand, { generateSlug, normalizeGroupPath, validateGroupPath } from './group.js';

describe('group command', () => {
  describe('command definition', () => {
    it('should support --tree option in group list', () => {
      const listSubcommand = groupCommand.commands.find((command) => command.name() === 'list');
      expect(listSubcommand).toBeDefined();
      expect(listSubcommand?.options.some((option) => option.long === '--tree')).toBe(true);
    });
  });

  // ============================================================================
  // normalizeGroupPath tests (spec §13.2)
  // ============================================================================

  describe('normalizeGroupPath', () => {
    it('should strip leading and trailing slashes', () => {
      expect(normalizeGroupPath('/kanyun/frontend/')).toBe('kanyun/frontend');
    });

    it('should collapse consecutive slashes', () => {
      expect(normalizeGroupPath('kanyun///frontend')).toBe('kanyun/frontend');
    });

    it('should lowercase the path', () => {
      expect(normalizeGroupPath('Kanyun/Frontend')).toBe('kanyun/frontend');
    });

    it('should trim whitespace', () => {
      expect(normalizeGroupPath('  kanyun/frontend  ')).toBe('kanyun/frontend');
    });

    it('should handle single segment', () => {
      expect(normalizeGroupPath('kanyun')).toBe('kanyun');
    });

    it('should handle complex normalization', () => {
      expect(normalizeGroupPath('  /Kanyun///Frontend/ ')).toBe('kanyun/frontend');
    });

    it('should handle empty string', () => {
      expect(normalizeGroupPath('')).toBe('');
    });
  });

  // ============================================================================
  // generateSlug tests (spec §13.4)
  // ============================================================================

  describe('generateSlug', () => {
    it('should lowercase and replace spaces with hyphens', () => {
      expect(generateSlug('Frontend Tools')).toBe('frontend-tools');
    });

    it('should replace underscores with hyphens', () => {
      expect(generateSlug('my_great_group')).toBe('my-great-group');
    });

    it('should strip non-alphanumeric characters', () => {
      expect(generateSlug('Hello World! @#$')).toBe('hello-world');
    });

    it('should collapse consecutive hyphens', () => {
      expect(generateSlug('hello---world')).toBe('hello-world');
    });

    it('should strip leading and trailing hyphens', () => {
      expect(generateSlug('-hello-world-')).toBe('hello-world');
    });

    it('should handle Chinese characters by stripping them', () => {
      expect(generateSlug('前端工具 tools')).toBe('tools');
    });

    it('should handle simple slug pass-through', () => {
      expect(generateSlug('frontend')).toBe('frontend');
    });

    it('should handle mixed case and special chars', () => {
      expect(generateSlug('My Company (Internal)')).toBe('my-company-internal');
    });

    it('should truncate generated slug to 64 chars', () => {
      expect(generateSlug('a'.repeat(100))).toBe('a'.repeat(64));
    });
  });

  // ============================================================================
  // validateGroupPath tests (spec §13.2)
  // ============================================================================

  describe('validateGroupPath', () => {
    it('should accept a valid normalized path', () => {
      expect(validateGroupPath('kanyun/frontend')).toEqual({ valid: true });
    });

    it('should reject empty path', () => {
      expect(validateGroupPath('')).toEqual({
        valid: false,
        error: 'Group path cannot be empty',
      });
    });

    it('should reject when depth is greater than 3', () => {
      expect(validateGroupPath('a/b/c/d')).toEqual({
        valid: false,
        error: 'Group path depth cannot exceed 3 segments',
      });
    });

    it('should reject invalid slug segments', () => {
      expect(validateGroupPath('kanyun/front_end')).toEqual({
        valid: false,
        error:
          'Invalid group path segment "front_end". Segments must match /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/',
      });
    });

    it('should reject segment longer than 64 chars', () => {
      const longSegment = 'a'.repeat(65);
      expect(validateGroupPath(`kanyun/${longSegment}`)).toEqual({
        valid: false,
        error: `Group path segment "${longSegment}" exceeds 64 characters`,
      });
    });
  });
});
