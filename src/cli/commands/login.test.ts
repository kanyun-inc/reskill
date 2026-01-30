/**
 * login command unit tests
 *
 * Tests for login command definition and options
 */

import { describe, expect, it } from 'vitest';
import { loginCommand } from './login.js';

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

    it('should have --token option for pre-generated tokens', () => {
      const tokenOption = loginCommand.options.find(
        (opt) => opt.short === '-t' || opt.long === '--token',
      );
      expect(tokenOption).toBeDefined();
      expect(tokenOption?.flags).toContain('-t');
      expect(tokenOption?.flags).toContain('--token');
      expect(tokenOption?.description).toContain('pre-generated token');
      expect(tokenOption?.description).toContain('CAS');
    });

    it('registry option should accept a URL argument', () => {
      const registryOption = loginCommand.options.find(
        (opt) => opt.long === '--registry',
      );
      // The flags contain <url> which indicates it takes an argument
      expect(registryOption?.flags).toContain('<url>');
    });

    it('token option should accept a token argument', () => {
      const tokenOption = loginCommand.options.find(
        (opt) => opt.long === '--token',
      );
      // The flags contain <token> which indicates it takes an argument
      expect(tokenOption?.flags).toContain('<token>');
    });
  });

  // ============================================================================
  // Option configuration tests
  // ============================================================================

  describe('option configuration', () => {
    it('should have 2 custom options (registry, token)', () => {
      // login has: -r/--registry, -t/--token
      // Note: --help is added automatically by commander but not in options array
      expect(loginCommand.options.length).toBe(2);
    });

    it('registry option should have correct short flag', () => {
      const registryOption = loginCommand.options.find(
        (opt) => opt.long === '--registry',
      );
      expect(registryOption?.short).toBe('-r');
    });

    it('token option should have correct short flag', () => {
      const tokenOption = loginCommand.options.find(
        (opt) => opt.long === '--token',
      );
      expect(tokenOption?.short).toBe('-t');
    });

    it('registry option description should mention environment variable', () => {
      const registryOption = loginCommand.options.find(
        (opt) => opt.long === '--registry',
      );
      expect(registryOption?.description).toContain('RESKILL_REGISTRY');
    });

    it('token option description should mention OAuth/CAS', () => {
      const tokenOption = loginCommand.options.find(
        (opt) => opt.long === '--token',
      );
      // Description mentions CAS/OAuth use case
      expect(tokenOption?.description).toContain('OAuth');
    });
  });
});
