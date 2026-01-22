import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for integration tests
 *
 * Integration tests run against the built CLI and require
 * the project to be built first (pnpm build).
 */
export default defineConfig({
  test: {
    include: ['src/cli/commands/__integration__/**/*.test.ts'],
    globals: true,
    environment: 'node',
    // Integration tests may take longer due to CLI execution
    testTimeout: 30000,
    // Run tests sequentially to avoid resource conflicts
    sequence: {
      concurrent: false,
    },
  },
});
