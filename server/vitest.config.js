import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each test file gets its own data file, and they must not share one, so
    // the suites run one after another rather than in parallel.
    fileParallelism: false,
    setupFiles: ['./tests/setup.js'],
  },
});
