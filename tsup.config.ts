import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  // The CLI is a leaf: bundling @clack/prompts in means `npx` resolves one
  // tarball with no transitive install step.
  noExternal: [/.*/],
  banner: { js: '#!/usr/bin/env node' },
  // No dts — there is no public API, only a bin.
  dts: false,
  sourcemap: false,
});
