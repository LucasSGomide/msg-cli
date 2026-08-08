import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'test/**/*.test.mjs'],
    // Integration tests scaffold into temp dirs and shell out; give them room.
    testTimeout: 30_000,
    environment: 'node',
  },
});
