import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each test file gets its own data file, and they must not share one, so
    // the suites run one after another rather than in parallel.
    fileParallelism: false,
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
