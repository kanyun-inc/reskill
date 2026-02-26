/**
 * login command unit tests
 *
 * Tests for login command definition, options, and interactive helpers
 */

import { describe, expect, it } from 'vitest';
import { getTokenPageUrl, loginCommand } from './login.js';

describe('login command', () => {
  // ============================================================================
  // Command definition tests
  // ============================================================================

  describe('command definition', () => {
    it('should have correct name', () => {
      expect(loginCommand.name()).toBe('login');
    });

    it('should have description', () => {
      expect(loginCommand.description()).toContain('Authenticate');
    });

    it('should have --registry option', () => {
      const registryOption = loginCommand.options.find(
        (opt) => opt.short === '-r' || opt.long === '--registry',
      );
      expect(registryOption).toBeDefined();
      expect(registryOption?.flags).toContain('-r');
      expect(registryOption?.flags).toContain('--registry');
      expect(registryOption?.description).toContain('Registry URL');
    });

    it('should have --token option for API token', () => {
      const tokenOption = loginCommand.options.find(
        (opt) => opt.short === '-t' || opt.long === '--token',
      );
      expect(tokenOption).toBeDefined();
      expect(tokenOption?.flags).toContain('-t');
      expect(tokenOption?.flags).toContain('--token');
      expect(tokenOption?.description).toContain('token');
    });

    it('registry option should accept a URL argument', () => {
      const registryOption = loginCommand.options.find((opt) => opt.long === '--registry');
      expect(registryOption?.flags).toContain('<url>');
    });

    it('token option should accept a token argument', () => {
      const tokenOption = loginCommand.options.find((opt) => opt.long === '--token');
      expect(tokenOption?.flags).toContain('<token>');
    });
  });

  // ============================================================================
  // Option configuration tests
  // ============================================================================

  describe('option configuration', () => {
    it('should have 2 custom options (registry, token)', () => {
      expect(loginCommand.options.length).toBe(2);
    });

    it('registry option should have correct short flag', () => {
      const registryOption = loginCommand.options.find((opt) => opt.long === '--registry');
      expect(registryOption?.short).toBe('-r');
    });

    it('token option should have correct short flag', () => {
      const tokenOption = loginCommand.options.find((opt) => opt.long === '--token');
      expect(tokenOption?.short).toBe('-t');
    });

    it('registry option description should mention environment variable', () => {
      const registryOption = loginCommand.options.find((opt) => opt.long === '--registry');
      expect(registryOption?.description).toContain('RESKILL_REGISTRY');
    });

    it('token option description should indicate it skips interactive prompt', () => {
      const tokenOption = loginCommand.options.find((opt) => opt.long === '--token');
      expect(tokenOption?.description).toContain('skips interactive');
    });
  });

  // ============================================================================
  // Interactive login support tests
  // ============================================================================

  describe('interactive login', () => {
    it('token option should not be mandatory for the command', () => {
      const tokenOption = loginCommand.options.find((opt) => opt.long === '--token');
      expect(tokenOption).toBeDefined();
      expect(tokenOption?.mandatory).toBeFalsy();
    });
  });
});

// ============================================================================
// Helper function tests
// ============================================================================

describe('getTokenPageUrl', () => {
  it('should append /skills/tokens to registry URL', () => {
    expect(getTokenPageUrl('https://registry.example.com')).toBe(
      'https://registry.example.com/skills/tokens',
    );
  });

  it('should strip trailing slash before appending path', () => {
    expect(getTokenPageUrl('https://registry.example.com/')).toBe(
      'https://registry.example.com/skills/tokens',
    );
  });

  it('should work with localhost URLs', () => {
    expect(getTokenPageUrl('http://localhost:3000')).toBe('http://localhost:3000/skills/tokens');
  });

  it('should work with URLs that have subpaths', () => {
    expect(getTokenPageUrl('https://example.com/registry')).toBe(
      'https://example.com/registry/skills/tokens',
    );
  });
});
