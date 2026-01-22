import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../utils/logger.js';
import { initCommand } from './init.js';

describe('init command', () => {
  describe('command definition', () => {
    it('should have correct name', () => {
      expect(initCommand.name()).toBe('init');
    });

    it('should have correct description', () => {
      expect(initCommand.description()).toBe('Initialize a new skills.json configuration');
    });

    it('should have -d/--install-dir option with default', () => {
      const option = initCommand.options.find((o) => o.long === '--install-dir');
      expect(option).toBeDefined();
      expect(option?.short).toBe('-d');
      expect(option?.defaultValue).toBe('.skills');
    });

    it('should have -y/--yes option', () => {
      const option = initCommand.options.find((o) => o.long === '--yes');
      expect(option).toBeDefined();
      expect(option?.short).toBe('-y');
    });
  });

  describe('execution', () => {
    let tempDir: string;
    let originalCwd: string;
    let loggerSuccessSpy: ReturnType<typeof vi.spyOn>;
    let loggerWarnSpy: ReturnType<typeof vi.spyOn>;
    let loggerLogSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reskill-init-test-'));
      originalCwd = process.cwd();
      process.chdir(tempDir);

      // Mock logger
      loggerSuccessSpy = vi.spyOn(logger, 'success').mockImplementation(() => {});
      loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      loggerLogSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
      vi.spyOn(logger, 'newline').mockImplementation(() => {});
    });

    afterEach(() => {
      process.chdir(originalCwd);
      fs.rmSync(tempDir, { recursive: true, force: true });
      vi.restoreAllMocks();
    });

    it('should create skills.json with correct structure', async () => {
      await initCommand.parseAsync(['node', 'test', '-y']);

      const configPath = path.join(tempDir, 'skills.json');
      expect(fs.existsSync(configPath)).toBe(true);

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      // Verify complete structure
      expect(config).toEqual({
        skills: {},
        defaults: {
          installDir: '.skills',
        },
      });
    });

    it('should create skills.json with default installDir', async () => {
      await initCommand.parseAsync(['node', 'test', '-y']);

      const config = JSON.parse(fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8'));
      expect(config.defaults.installDir).toBe('.skills');
    });

    it('should accept --install-dir long option', async () => {
      await initCommand.parseAsync(['node', 'test', '-y', '--install-dir', 'custom-skills']);

      const config = JSON.parse(fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8'));
      expect(config.defaults.installDir).toBe('custom-skills');
    });

    it('should accept -d short option', async () => {
      await initCommand.parseAsync(['node', 'test', '-y', '-d', 'short-option-dir']);

      const config = JSON.parse(fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8'));
      expect(config.defaults.installDir).toBe('short-option-dir');
    });

    it('should accept --yes long option', async () => {
      await initCommand.parseAsync(['node', 'test', '--yes']);

      expect(fs.existsSync(path.join(tempDir, 'skills.json'))).toBe(true);
    });

    it('should log success message on creation', async () => {
      await initCommand.parseAsync(['node', 'test', '-y']);

      expect(loggerSuccessSpy).toHaveBeenCalledWith('Created skills.json');
    });

    it('should log configuration details', async () => {
      await initCommand.parseAsync(['node', 'test', '-y', '-d', 'my-skills']);

      expect(loggerLogSpy).toHaveBeenCalledWith('Configuration:');
      expect(loggerLogSpy).toHaveBeenCalledWith('  Install directory: my-skills');
    });

    it('should log next steps', async () => {
      await initCommand.parseAsync(['node', 'test', '-y']);

      expect(loggerLogSpy).toHaveBeenCalledWith('Next steps:');
      expect(loggerLogSpy).toHaveBeenCalledWith('  reskill install <skill>  Install a skill');
      expect(loggerLogSpy).toHaveBeenCalledWith('  reskill list             List installed skills');
    });

    it('should not overwrite existing skills.json', async () => {
      const existingConfig = { skills: { 'existing-skill': 'github:user/skill' } };
      fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify(existingConfig));

      await initCommand.parseAsync(['node', 'test', '-y']);

      const config = JSON.parse(fs.readFileSync(path.join(tempDir, 'skills.json'), 'utf-8'));
      expect(config.skills['existing-skill']).toBe('github:user/skill');
    });

    it('should warn when skills.json already exists', async () => {
      fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify({ skills: {} }));

      await initCommand.parseAsync(['node', 'test', '-y']);

      expect(loggerWarnSpy).toHaveBeenCalledWith('skills.json already exists');
      expect(loggerSuccessSpy).not.toHaveBeenCalled();
    });

    it('should not log success when skills.json already exists', async () => {
      fs.writeFileSync(path.join(tempDir, 'skills.json'), JSON.stringify({ skills: {} }));

      await initCommand.parseAsync(['node', 'test', '-y']);

      expect(loggerSuccessSpy).not.toHaveBeenCalled();
    });
  });
});
