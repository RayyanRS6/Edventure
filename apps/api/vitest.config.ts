import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/support/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Each file gets its own database cloned from a migrated template, so files can run in parallel.
    fileParallelism: true,
    pool: 'forks',
  },
});
