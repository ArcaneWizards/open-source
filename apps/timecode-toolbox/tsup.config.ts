import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/start.ts', 'src/components/frontend/index.tsx'],
  format: ['cjs', 'esm'],
  splitting: false,
  dts: true,
  external: ['../LICENSE'],
  sourcemap: false,
});
