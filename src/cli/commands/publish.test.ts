/**
 * publish command unit tests
 *
 * Tests for helper functions in the publish command
 */

import { describe, expect, it } from 'vitest';
import { getScopeForRegistry } from '../../utils/registry-scope.js';
import {
  buildPublishSkillName,
  isBlockedPublicRegistry,
  parseConfirmAnswer,
  parseVersionInput,
} from './publish.js';

describe('publish command', () => {
  // ============================================================================
  // isBlockedPublicRegistry tests
  // ============================================================================

  describe('isBlockedPublicRegistry', () => {
    describe('should block public registries', () => {
      it('should block reskill.info', () => {
        expect(isBlockedPublicRegistry('https://reskill.info')).toBe(true);
      });

      it('should block www.reskill.info', () => {
        expect(isBlockedPublicRegistry('https://www.reskill.info')).toBe(true);
      });

      it('should block registry.reskill.info', () => {
        expect(isBlockedPublicRegistry('https://registry.reskill.info')).toBe(true);
      });

      it('should block api.reskill.info', () => {
        expect(isBlockedPublicRegistry('https://api.reskill.info')).toBe(true);
      });

      it('should block with path', () => {
        expect(isBlockedPublicRegistry('https://reskill.info/api/v1')).toBe(true);
      });

      it('should block with port', () => {
        expect(isBlockedPublicRegistry('https://reskill.info:443')).toBe(true);
      });

      it('should block http (not https)', () => {
        expect(isBlockedPublicRegistry('http://reskill.info')).toBe(true);
      });

      it('should block subdomains of reskill.info', () => {
        expect(isBlockedPublicRegistry('https://sub.api.reskill.info')).toBe(true);
      });

      it('should be case insensitive', () => {
        expect(isBlockedPublicRegistry('https://RESKILL.INFO')).toBe(true);
        expect(isBlockedPublicRegistry('https://Reskill.Info')).toBe(true);
      });
    });

    describe('should allow private registries', () => {
      it('should allow custom private domain', () => {
        expect(isBlockedPublicRegistry('https://reskill-test.zhenguanyu.com')).toBe(false);
      });

      it('should allow localhost', () => {
        expect(isBlockedPublicRegistry('http://localhost:3000')).toBe(false);
      });

      it('should allow 127.0.0.1', () => {
        expect(isBlockedPublicRegistry('http://127.0.0.1:3000')).toBe(false);
      });

      it('should allow internal company domain', () => {
        expect(isBlockedPublicRegistry('https://registry.company.internal')).toBe(false);
      });

      it('should allow other .info domains', () => {
        expect(isBlockedPublicRegistry('https://other-registry.info')).toBe(false);
      });

      it('should allow domains containing reskill but not reskill.info', () => {
        expect(isBlockedPublicRegistry('https://reskill-private.com')).toBe(false);
        expect(isBlockedPublicRegistry('https://my-reskill.org')).toBe(false);
      });

      it('should not block reskill.info as part of another domain', () => {
        // e.g., reskill.info.example.com is NOT reskill.info
        expect(isBlockedPublicRegistry('https://reskill.info.example.com')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle invalid URL gracefully', () => {
        // Falls back to string matching
        expect(isBlockedPublicRegistry('not-a-url')).toBe(false);
      });

      it('should handle malformed URL with reskill.info', () => {
        // Falls back to string matching
        expect(isBlockedPublicRegistry('reskill.info')).toBe(true);
      });

      it('should handle empty string', () => {
        expect(isBlockedPublicRegistry('')).toBe(false);
      });
    });
  });

  // ============================================================================
  // buildPublishSkillName tests
  // ============================================================================

  describe('buildPublishSkillName', () => {
    describe('with known registry scope', () => {
      it('should build skill name with registry scope for kanyun registry', () => {
        const result = buildPublishSkillName(
          'planning-with-files',
          'https://reskill-test.zhenguanyu.com/',
          'wangzirenbj',
        );
        // Should use @kanyun (registry scope), not @wangzirenbj (user handle)
        expect(result).toBe('@kanyun/planning-with-files');
      });

      it('should handle registry without trailing slash', () => {
        const result = buildPublishSkillName(
          'my-skill',
          'https://reskill-test.zhenguanyu.com',
          'someuser',
        );
        expect(result).toBe('@kanyun/my-skill');
      });
    });

    describe('with unknown registry scope', () => {
      it('should throw error for unknown registry (no fallback)', () => {
        // Registry must be in REGISTRY_SCOPE_MAP, no fallback to userHandle
        expect(() =>
          buildPublishSkillName('my-skill', 'https://unknown-registry.com/', 'wangzirenbj'),
        ).toThrow('No scope configured for registry');
      });
    });

    describe('with name already containing scope', () => {
      it('should keep existing scope if name already has one', () => {
        const result = buildPublishSkillName(
          '@existing/my-skill',
          'https://reskill-test.zhenguanyu.com/',
          'wangzirenbj',
        );
        // Should preserve existing scope
        expect(result).toBe('@existing/my-skill');
      });
    });
  });

  // ============================================================================
  // getScopeForRegistry tests (integration)
  // ============================================================================

  describe('getScopeForRegistry', () => {
    it('should return @kanyun for reskill-test.zhenguanyu.com', () => {
      expect(getScopeForRegistry('https://reskill-test.zhenguanyu.com/')).toBe('@kanyun');
    });

    it('should return null for unknown registry', () => {
      expect(getScopeForRegistry('https://other-registry.com/')).toBeNull();
    });
  });

  // ============================================================================
  // parseConfirmAnswer tests
  // ============================================================================

  describe('parseConfirmAnswer', () => {
    describe('should confirm (return true)', () => {
      it('should return true for empty string (default yes)', () => {
        expect(parseConfirmAnswer('')).toBe(true);
      });

      it('should return true for whitespace only (default yes)', () => {
        expect(parseConfirmAnswer('   ')).toBe(true);
        expect(parseConfirmAnswer('\t')).toBe(true);
        expect(parseConfirmAnswer('\n')).toBe(true);
      });

      it('should return true for "y"', () => {
        expect(parseConfirmAnswer('y')).toBe(true);
      });

      it('should return true for "Y"', () => {
        expect(parseConfirmAnswer('Y')).toBe(true);
      });

      it('should return true for "yes"', () => {
        expect(parseConfirmAnswer('yes')).toBe(true);
      });

      it('should return true for "YES"', () => {
        expect(parseConfirmAnswer('YES')).toBe(true);
      });

      it('should return true for "Yes"', () => {
        expect(parseConfirmAnswer('Yes')).toBe(true);
      });

      it('should return true for any other input (forgiving default)', () => {
        expect(parseConfirmAnswer('ok')).toBe(true);
        expect(parseConfirmAnswer('sure')).toBe(true);
        expect(parseConfirmAnswer('yep')).toBe(true);
        expect(parseConfirmAnswer('xyz')).toBe(true);
      });

      it('should return true for "y" with whitespace', () => {
        expect(parseConfirmAnswer('  y  ')).toBe(true);
        expect(parseConfirmAnswer('\ty\n')).toBe(true);
      });
    });

    describe('should decline (return false)', () => {
      it('should return false for "n"', () => {
        expect(parseConfirmAnswer('n')).toBe(false);
      });

      it('should return false for "N"', () => {
        expect(parseConfirmAnswer('N')).toBe(false);
      });

      it('should return false for "no"', () => {
        expect(parseConfirmAnswer('no')).toBe(false);
      });

      it('should return false for "NO"', () => {
        expect(parseConfirmAnswer('NO')).toBe(false);
      });

      it('should return false for "No"', () => {
        expect(parseConfirmAnswer('No')).toBe(false);
      });

      it('should return false for "n" with whitespace', () => {
        expect(parseConfirmAnswer('  n  ')).toBe(false);
        expect(parseConfirmAnswer('\tno\n')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should return true for "nope" (not exactly "n" or "no")', () => {
        // "nope" is not "n" or "no", so it confirms (forgiving behavior)
        expect(parseConfirmAnswer('nope')).toBe(true);
      });

      it('should return true for "nah" (not exactly "n" or "no")', () => {
        expect(parseConfirmAnswer('nah')).toBe(true);
      });

      it('should return true for "maybe"', () => {
        expect(parseConfirmAnswer('maybe')).toBe(true);
      });
    });
  });

  // ============================================================================
  // parseVersionInput tests
  // ============================================================================

  describe('parseVersionInput', () => {
    describe('valid version input', () => {
      it('should accept valid semver version', () => {
        const result = parseVersionInput('1.0.0');
        expect(result).toEqual({ valid: true, version: '1.0.0' });
      });

      it('should accept version with prerelease tag', () => {
        const result = parseVersionInput('1.0.0-beta.1');
        expect(result).toEqual({ valid: true, version: '1.0.0-beta.1' });
      });

      it('should accept version with build metadata', () => {
        const result = parseVersionInput('1.0.0+build.123');
        expect(result).toEqual({ valid: true, version: '1.0.0+build.123' });
      });

      it('should trim whitespace from input', () => {
        const result = parseVersionInput('  1.0.0  ');
        expect(result).toEqual({ valid: true, version: '1.0.0' });
      });
    });

    describe('empty input (cancel)', () => {
      it('should return cancelled for empty string', () => {
        const result = parseVersionInput('');
        expect(result).toEqual({ valid: false, cancelled: true });
      });

      it('should return cancelled for whitespace only', () => {
        const result = parseVersionInput('   ');
        expect(result).toEqual({ valid: false, cancelled: true });
      });
    });

    describe('invalid version input', () => {
      it('should reject invalid semver', () => {
        const result = parseVersionInput('invalid');
        expect(result.valid).toBe(false);
        expect(result.cancelled).toBeUndefined();
        expect(result.error).toContain('Invalid version format');
      });

      it('should reject version with v prefix', () => {
        const result = parseVersionInput('v1.0.0');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('v');
      });

      it('should reject partial version', () => {
        const result = parseVersionInput('1.0');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });
});
