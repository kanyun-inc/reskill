/**
 * SkillValidator unit tests
 *
 * Tests for validating SKILL.md for publishing
 *
 * Following agentskills.io specification:
 * - SKILL.md is REQUIRED with name and description in frontmatter
 * - All metadata (name, version, description, license) comes from SKILL.md
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildFullSkillName, getShortName } from '../utils/registry-scope.js';
import { SkillValidator } from './skill-validator.js';

describe('SkillValidator', () => {
  let tempDir: string;
  let validator: SkillValidator;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-validator-test-'));
    validator = new SkillValidator();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // Helper functions
  function createSkillJson(content: object): void {
    fs.writeFileSync(path.join(tempDir, 'skill.json'), JSON.stringify(content, null, 2));
  }

  function createSkillMd(content: string): void {
    fs.writeFileSync(path.join(tempDir, 'SKILL.md'), content);
  }

  /** Create a valid SKILL.md with required frontmatter */
  function createValidSkillMd(
    name = 'my-skill',
    description = 'A helpful skill',
    extra = '',
  ): void {
    createSkillMd(`---
name: ${name}
description: ${description}${extra}
---
# ${name}

This is the skill content.`);
  }

  // ============================================================================
  // validateName tests
  // ============================================================================

  describe('validateName', () => {
    it('should accept valid lowercase name', () => {
      const result = validator.validateName('my-skill');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept name with numbers', () => {
      const result = validator.validateName('skill-v2');
      expect(result.valid).toBe(true);
    });

    it('should accept name starting with number', () => {
      const result = validator.validateName('2048-game');
      expect(result.valid).toBe(true);
    });

    it('should accept single character name', () => {
      const result = validator.validateName('a');
      expect(result.valid).toBe(true);
    });

    it('should accept two character name', () => {
      const result = validator.validateName('ab');
      expect(result.valid).toBe(true);
    });

    it('should reject empty name', () => {
      const result = validator.validateName('');
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('name');
    });

    it('should reject uppercase letters', () => {
      const result = validator.validateName('MySkill');
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('lowercase');
    });

    it('should reject names starting with hyphen', () => {
      const result = validator.validateName('-my-skill');
      expect(result.valid).toBe(false);
    });

    it('should reject names ending with hyphen', () => {
      const result = validator.validateName('my-skill-');
      expect(result.valid).toBe(false);
    });

    it('should reject names with consecutive hyphens', () => {
      const result = validator.validateName('my--skill');
      expect(result.valid).toBe(false);
    });

    it('should reject names longer than 64 characters', () => {
      const longName = 'a'.repeat(65);
      const result = validator.validateName(longName);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('64');
    });

    it('should accept names exactly 64 characters', () => {
      const name = 'a'.repeat(64);
      const result = validator.validateName(name);
      expect(result.valid).toBe(true);
    });

    it('should reject names with special characters', () => {
      const result = validator.validateName('my_skill');
      expect(result.valid).toBe(false);
    });

    it('should reject names with spaces', () => {
      const result = validator.validateName('my skill');
      expect(result.valid).toBe(false);
    });

    it('should reject names with dots', () => {
      const result = validator.validateName('my.skill');
      expect(result.valid).toBe(false);
    });
  });

  // ============================================================================
  // validateVersion tests
  // ============================================================================

  describe('validateVersion', () => {
    it('should accept valid semver 1.0.0', () => {
      const result = validator.validateVersion('1.0.0');
      expect(result.valid).toBe(true);
    });

    it('should accept semver with zero major', () => {
      const result = validator.validateVersion('0.1.0');
      expect(result.valid).toBe(true);
    });

    it('should accept large version numbers', () => {
      const result = validator.validateVersion('10.20.30');
      expect(result.valid).toBe(true);
    });

    it('should accept semver with prerelease alpha', () => {
      const result = validator.validateVersion('1.0.0-alpha');
      expect(result.valid).toBe(true);
    });

    it('should accept semver with prerelease beta.1', () => {
      const result = validator.validateVersion('1.0.0-beta.1');
      expect(result.valid).toBe(true);
    });

    it('should accept semver with prerelease rc.1', () => {
      const result = validator.validateVersion('1.0.0-rc.1');
      expect(result.valid).toBe(true);
    });

    it('should accept semver with build metadata', () => {
      const result = validator.validateVersion('1.0.0+build.123');
      expect(result.valid).toBe(true);
    });

    it('should reject version with only two parts', () => {
      const result = validator.validateVersion('1.0');
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('semver');
    });

    it('should reject version with v prefix', () => {
      const result = validator.validateVersion('v1.0.0');
      expect(result.valid).toBe(false);
    });

    it('should reject version with only one part', () => {
      const result = validator.validateVersion('1');
      expect(result.valid).toBe(false);
    });

    it('should reject non-numeric version', () => {
      const result = validator.validateVersion('latest');
      expect(result.valid).toBe(false);
    });

    it('should reject empty version', () => {
      const result = validator.validateVersion('');
      expect(result.valid).toBe(false);
    });
  });

  // ============================================================================
  // validateDescription tests
  // ============================================================================

  describe('validateDescription', () => {
    it('should accept valid description', () => {
      const result = validator.validateDescription('A helpful AI skill');
      expect(result.valid).toBe(true);
    });

    it('should accept description with special characters', () => {
      const result = validator.validateDescription("It's a great skill! (version 2.0)");
      expect(result.valid).toBe(true);
    });

    it('should reject empty description', () => {
      const result = validator.validateDescription('');
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('description');
    });

    it('should reject description over 1024 chars', () => {
      const longDesc = 'a'.repeat(1025);
      const result = validator.validateDescription(longDesc);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('1024');
    });

    it('should accept description exactly 1024 chars', () => {
      const desc = 'a'.repeat(1024);
      const result = validator.validateDescription(desc);
      expect(result.valid).toBe(true);
    });

    it('should accept description with < character (per agentskills.io spec)', () => {
      const result = validator.validateDescription('Use <tool> for tasks');
      expect(result.valid).toBe(true);
    });

    it('should accept description with > character (per agentskills.io spec)', () => {
      const result = validator.validateDescription('Value > 10');
      expect(result.valid).toBe(true);
    });
  });

  // ============================================================================
  // validate (full skill directory) tests
  // ============================================================================

  describe('validate', () => {
    describe('SKILL.md validation (required)', () => {
      it('should pass with valid SKILL.md only', () => {
        createValidSkillMd();

        const result = validator.validate(tempDir);
        expect(result.valid).toBe(true);
        // No longer warns about missing skill.json since SKILL.md is the sole source
      });

      it('should fail without SKILL.md', () => {
        const result = validator.validate(tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('SKILL.md');
        expect(result.errors[0].message).toContain('not found');
      });

      it('should fail when SKILL.md has no frontmatter', () => {
        createSkillMd('# My Skill\n\nNo frontmatter here');

        const result = validator.validate(tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('SKILL.md');
        expect(result.errors[0].message).toContain('frontmatter');
      });

      it('should fail without name in SKILL.md', () => {
        createSkillMd(`---
description: A skill
---
# Content`);

        const result = validator.validate(tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('SKILL.md');
      });

      it('should fail without description in SKILL.md', () => {
        createSkillMd(`---
name: my-skill
---
# Content`);

        const result = validator.validate(tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('SKILL.md');
      });

      it('should fail when SKILL.md has uppercase name', () => {
        createSkillMd(`---
name: MySkill
description: A skill with uppercase name
---
# Content`);

        const result = validator.validate(tempDir);
        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) => e.field === 'name' && e.message.includes('lowercase')),
        ).toBe(true);
      });

      it('should fail when SKILL.md name starts with hyphen', () => {
        createSkillMd(`---
name: -invalid-skill
description: A skill starting with hyphen
---
# Content`);

        const result = validator.validate(tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.field === 'name')).toBe(true);
      });

      it('should fail with invalid name format in SKILL.md', () => {
        createSkillMd(`---
name: MySkill
description: A skill
---
# Content`);

        const result = validator.validate(tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.field === 'name')).toBe(true);
      });

      it('should accept description with angle brackets in SKILL.md (per spec)', () => {
        createSkillMd(`---
name: my-skill
description: Use <tool> for tasks
---
# Content`);

        const result = validator.validate(tempDir);
        expect(result.valid).toBe(true);
      });
    });

    describe('skill.json is ignored (SKILL.md is sole source)', () => {
      it('should ignore skill.json entirely and only use SKILL.md', () => {
        createValidSkillMd(); // Creates name: 'my-skill', description: 'A helpful skill'
        createSkillJson({
          name: 'different-name',
          version: '99.0.0',
          description: 'Different description',
        });

        const result = validator.validate(tempDir);
        // Should pass - skill.json is completely ignored
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);

        // Verify loaded data comes from SKILL.md, not skill.json
        const skill = validator.loadSkill(tempDir);
        expect(skill.skillJson?.name).toBe('my-skill'); // From SKILL.md
        expect(skill.skillJson?.version).toBe('0.0.0'); // Default version, not 99.0.0
        expect(skill.skillJson?.description).toBe('A helpful skill'); // From SKILL.md
      });

      it('should pass even if skill.json has invalid JSON', () => {
        createValidSkillMd();
        fs.writeFileSync(path.join(tempDir, 'skill.json'), '{ invalid json }');

        const result = validator.validate(tempDir);
        // Should pass - skill.json is ignored
        expect(result.valid).toBe(true);
      });

      // Note: Keywords array parsing from SKILL.md metadata is not supported by the simple YAML parser
      // Keywords validation was removed since SKILL.md metadata arrays aren't fully parsed
    });

    describe('version validation', () => {
      it('should warn when no version specified (SKILL.md only)', () => {
        createValidSkillMd();

        const result = validator.validate(tempDir);
        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.field === 'version')).toBe(true);
      });

      it('should accept version from SKILL.md metadata', () => {
        createSkillMd(`---
name: my-skill
description: A helpful skill
metadata:
  version: "1.2.3"
---
# Content`);

        const result = validator.validate(tempDir);
        expect(result.valid).toBe(true);
        // Should not warn about missing version
        expect(result.warnings.some((w) => w.field === 'version')).toBe(false);
      });

      it('should fail with invalid version in SKILL.md metadata', () => {
        createSkillMd(`---
name: my-skill
description: A helpful skill
metadata:
  version: "invalid"
---
# Content`);

        const result = validator.validate(tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.field === 'version')).toBe(true);
      });

      it('should accept version from skill.json when both exist', () => {
        createValidSkillMd();
        createSkillJson({
          name: 'my-skill',
          version: '2.0.0',
          description: 'A skill',
        });

        const result = validator.validate(tempDir);
        expect(result.valid).toBe(true);
      });
    });

    describe('license validation', () => {
      it('should warn for missing license', () => {
        createValidSkillMd();

        const result = validator.validate(tempDir);
        expect(result.warnings.some((w) => w.field === 'license')).toBe(true);
      });

      it('should not warn when license is in SKILL.md', () => {
        createSkillMd(`---
name: my-skill
description: A helpful skill
license: MIT
---
# Content`);

        const result = validator.validate(tempDir);
        expect(result.warnings.some((w) => w.field === 'license')).toBe(false);
      });

      // Removed test: skill.json license is no longer checked
    });

    // Entry file validation removed: skill.json is no longer used
    // SKILL.md is always the entry point
  });

  // ============================================================================
  // loadSkill tests
  // ============================================================================

  describe('loadSkill', () => {
    it('excludes macOS metadata files from the scanned files list (#3062)', () => {
      createValidSkillMd();
      fs.writeFileSync(path.join(tempDir, '_private.md'), 'normal underscore file');
      fs.writeFileSync(path.join(tempDir, '._SKILL.md'), 'appledouble junk');
      fs.writeFileSync(path.join(tempDir, '.DS_Store'), 'finder junk');
      fs.mkdirSync(path.join(tempDir, '__MACOSX'), { recursive: true });
      // 文件名刻意不带 ._ 前缀：单独守住 name === '__MACOSX' 那半个判据，
      // 否则 ._-prefixed 夹具会让它被 startsWith('._') 误代过
      fs.writeFileSync(path.join(tempDir, '__MACOSX', 'plainname'), 'zip metadata junk');
      fs.mkdirSync(path.join(tempDir, 'sub'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'sub', '._nested.txt'), 'nested appledouble');

      const loaded = validator.loadSkill(tempDir);

      expect(loaded.files).toContain('SKILL.md');
      expect(loaded.files).toContain('_private.md');
      expect(loaded.files).not.toContain('._SKILL.md');
      expect(loaded.files).not.toContain('.DS_Store');
      expect(loaded.files.some((f) => f.startsWith('__MACOSX'))).toBe(false);
      expect(loaded.files.some((f) => f.split('/').some((seg) => seg.startsWith('._')))).toBe(
        false,
      );
    });

    it('should synthesize skillJson from SKILL.md content', () => {
      createSkillMd(`---
name: my-skill
version: 1.0.0
description: A skill
---
# Content`);

      const skill = validator.loadSkill(tempDir);
      // skillJson is synthesized from SKILL.md
      expect(skill.skillJson).not.toBeNull();
      expect(skill.skillJson?.name).toBe('my-skill');
      expect(skill.skillJson?.version).toBe('1.0.0');
    });

    it('should load SKILL.md content', () => {
      createSkillMd(`---
name: my-skill
description: A test skill
---
# Content`);

      const skill = validator.loadSkill(tempDir);
      expect(skill.skillMd).not.toBeNull();
      expect(skill.skillMd?.name).toBe('my-skill');
      expect(skill.skillMd?.description).toBe('A test skill');
    });

    it('should use default version when not specified in SKILL.md', () => {
      createValidSkillMd('test-skill', 'Test description');

      const skill = validator.loadSkill(tempDir);
      // skillJson is always synthesized from SKILL.md
      expect(skill.skillJson).not.toBeNull();
      expect(skill.skillJson?.name).toBe('test-skill');
      expect(skill.skillJson?.description).toBe('Test description');
      expect(skill.skillJson?.version).toBe('0.0.0'); // Default version when not specified
    });

    it('should use version from SKILL.md metadata', () => {
      createSkillMd(`---
name: my-skill
description: A test skill
metadata:
  version: "2.0.0"
---
# Content`);

      const skill = validator.loadSkill(tempDir);
      expect(skill.skillJson).not.toBeNull();
      expect(skill.skillJson?.version).toBe('2.0.0');
    });

    it('should return null skillJson when neither file exists', () => {
      const skill = validator.loadSkill(tempDir);
      expect(skill.skillJson).toBeNull();
      expect(skill.skillMd).toBeNull();
    });

    it('should return null skillJson when SKILL.md does not exist', () => {
      // skill.json is ignored - only SKILL.md matters
      createSkillJson({
        name: 'my-skill',
        version: '1.0.0',
        description: 'A skill',
      });

      const skill = validator.loadSkill(tempDir);
      expect(skill.skillMd).toBeNull();
      // skillJson is only synthesized from SKILL.md, so it's null when SKILL.md doesn't exist
      expect(skill.skillJson).toBeNull();
    });

    it('should scan files list', () => {
      createValidSkillMd();
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# README');

      const skill = validator.loadSkill(tempDir);
      // skill.json is not included in default files
      expect(skill.files).toContain('SKILL.md');
      expect(skill.files).toContain('README.md');
    });

    it('should include SKILL.md in files when only SKILL.md exists', () => {
      createValidSkillMd();

      const skill = validator.loadSkill(tempDir);
      expect(skill.files).toContain('SKILL.md');
      expect(skill.files).not.toContain('skill.json');
    });

    it('should include files from skill.json files array', () => {
      createValidSkillMd();
      fs.mkdirSync(path.join(tempDir, 'examples'));
      fs.writeFileSync(path.join(tempDir, 'examples', 'basic.md'), '# Basic');
      createSkillJson({
        name: 'my-skill',
        version: '1.0.0',
        description: 'A skill',
        files: ['examples/'],
      });

      const skill = validator.loadSkill(tempDir);
      expect(skill.files.some((f) => f.includes('examples'))).toBe(true);
    });

    it('should auto-scan all files when no skill.json exists', () => {
      createValidSkillMd();
      // Create some extra files and directories
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# README');
      fs.writeFileSync(path.join(tempDir, 'examples.md'), '# Examples');
      fs.mkdirSync(path.join(tempDir, 'scripts'));
      fs.writeFileSync(path.join(tempDir, 'scripts', 'init.sh'), '#!/bin/bash');
      fs.mkdirSync(path.join(tempDir, 'templates'));
      fs.writeFileSync(path.join(tempDir, 'templates', 'task.md'), '# Task');

      const skill = validator.loadSkill(tempDir);
      expect(skill.files).toContain('SKILL.md');
      expect(skill.files).toContain('README.md');
      expect(skill.files).toContain('examples.md');
      expect(
        skill.files.some((f) => f.includes('scripts/init.sh') || f.includes('scripts\\init.sh')),
      ).toBe(true);
      expect(
        skill.files.some(
          (f) => f.includes('templates/task.md') || f.includes('templates\\task.md'),
        ),
      ).toBe(true);
    });

    it('should exclude .git and node_modules when auto-scanning', () => {
      createValidSkillMd();
      // Create directories that should be excluded
      fs.mkdirSync(path.join(tempDir, '.git'));
      fs.writeFileSync(path.join(tempDir, '.git', 'config'), 'git config');
      fs.mkdirSync(path.join(tempDir, 'node_modules'));
      fs.writeFileSync(path.join(tempDir, 'node_modules', 'package.json'), '{}');
      // Create a file that should be included
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# README');

      const skill = validator.loadSkill(tempDir);
      expect(skill.files).toContain('SKILL.md');
      expect(skill.files).toContain('README.md');
      expect(skill.files.some((f) => f.includes('.git'))).toBe(false);
      expect(skill.files.some((f) => f.includes('node_modules'))).toBe(false);
    });

    it('should use version from top-level SKILL.md frontmatter', () => {
      createSkillMd(`---
name: my-skill
description: A helpful skill
version: "2.4.1"
---
# Content`);

      const skill = validator.loadSkill(tempDir);
      expect(skill.skillJson).not.toBeNull();
      expect(skill.skillJson?.version).toBe('2.4.1');
    });
  });

  // ============================================================================
  // buildFullSkillName integration tests (using registry-scope utilities)
  // ============================================================================

  describe('scope integration', () => {
    it('should build full skill name with scope', () => {
      const fullName = buildFullSkillName('@kanyun', 'planning-with-files');
      expect(fullName).toBe('@kanyun/planning-with-files');
    });

    it('should extract short name from scoped skill name', () => {
      const shortName = getShortName('@kanyun/planning-with-files');
      expect(shortName).toBe('planning-with-files');
    });

    it('should use short name for directory when loading skill', () => {
      // Create SKILL.md with name (without scope)
      createSkillMd(`---
name: planning-with-files
description: A helpful skill
version: "1.0.0"
---
# Content`);

      const skill = validator.loadSkill(tempDir);
      expect(skill.skillJson).not.toBeNull();
      // The name in SKILL.md should be the short name (without scope)
      expect(skill.skillJson?.name).toBe('planning-with-files');

      // When combined with scope, it becomes the full name
      const fullName = buildFullSkillName('@kanyun', skill.skillJson?.name || '');
      expect(fullName).toBe('@kanyun/planning-with-files');
    });

    it('should validate skill name without scope prefix', () => {
      // Name in SKILL.md should not include scope
      const result = validator.validateName('planning-with-files');
      expect(result.valid).toBe(true);
    });

    it('should reject name with scope prefix (scope should be added by registry)', () => {
      // Names with @ prefix should be rejected (scope is added separately)
      const result = validator.validateName('@kanyun/planning-with-files');
      expect(result.valid).toBe(false);
    });
  });

  // generateIntegrity tests
  // ============================================================================

  describe('generateIntegrity', () => {
    it('should generate sha256 hash', () => {
      createSkillJson({ name: 'test', version: '1.0.0', description: 'test' });

      const hash = validator.generateIntegrity(tempDir, ['skill.json']);
      expect(hash).toMatch(/^sha256-[a-f0-9]{64}$/);
    });

    it('should exclude macOS metadata files from the hash (#3062)', () => {
      createSkillJson({ name: 'test', version: '1.0.0', description: 'test' });
      fs.writeFileSync(path.join(tempDir, '._SKILL.md'), 'appledouble junk');
      fs.writeFileSync(path.join(tempDir, 'junk'), 'junk');

      // Hash over clean + junk list must equal hash over clean list only —
      // the hashed file set has to match what createTarball packs
      const clean = validator.generateIntegrity(tempDir, ['skill.json']);
      const withJunk = validator.generateIntegrity(tempDir, [
        'skill.json',
        '._SKILL.md',
        '__MACOSX/._test',
        'pptx/.DS_Store',
      ]);

      expect(withJunk).toBe(clean);
    });

    it('should generate consistent hash for same content', () => {
      createSkillJson({ name: 'test', version: '1.0.0', description: 'test' });

      const hash1 = validator.generateIntegrity(tempDir, ['skill.json']);
      const hash2 = validator.generateIntegrity(tempDir, ['skill.json']);
      expect(hash1).toBe(hash2);
    });

    it('should change when file content changes', () => {
      createSkillJson({ name: 'test', version: '1.0.0', description: 'test' });
      const hash1 = validator.generateIntegrity(tempDir, ['skill.json']);

      createSkillJson({ name: 'test', version: '1.0.1', description: 'test' });
      const hash2 = validator.generateIntegrity(tempDir, ['skill.json']);

      expect(hash1).not.toBe(hash2);
    });

    it('should be independent of file order', () => {
      fs.writeFileSync(path.join(tempDir, 'a.txt'), 'aaa');
      fs.writeFileSync(path.join(tempDir, 'b.txt'), 'bbb');

      const hash1 = validator.generateIntegrity(tempDir, ['a.txt', 'b.txt']);
      const hash2 = validator.generateIntegrity(tempDir, ['b.txt', 'a.txt']);

      expect(hash1).toBe(hash2);
    });

    it('should include file names in hash', () => {
      fs.writeFileSync(path.join(tempDir, 'a.txt'), 'content');
      fs.writeFileSync(path.join(tempDir, 'b.txt'), 'content');

      const hash1 = validator.generateIntegrity(tempDir, ['a.txt']);
      const hash2 = validator.generateIntegrity(tempDir, ['b.txt']);

      // Same content but different file names should produce different hashes
      expect(hash1).not.toBe(hash2);
    });
  });
});
