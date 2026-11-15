import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Each test file gets its own data file, and they must not share one, so
    // the suites run one after another rather than in parallel.
    // Also stops local JSON file from locking up.
    fileParallelism: false,
    testTimeout: 10000,     // Gives Supertest 10 seconds instead of 5
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/index.js', 'src/seed.js', 'src/reset.js'],
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: './coverage',
    },
  },
});