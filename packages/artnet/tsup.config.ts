import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/constants.ts'],
  format: ['cjs', 'esm'],
  splitting: true,
  dts: true,
  external: ['@arcanejs/diff'],
});
