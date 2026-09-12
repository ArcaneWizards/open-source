import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/constants.ts', 'src/monitor.ts'],
  format: ['cjs', 'esm'],
  splitting: true,
  dts: true,
});
