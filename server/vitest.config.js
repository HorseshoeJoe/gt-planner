import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        fileParallelism: false, // Stops local JSON file from locking up
        testTimeout: 10000,     // Gives Supertest 10 seconds instead of 5
    },
});