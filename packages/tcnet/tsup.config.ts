import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/errors.ts',
    'src/index.ts',
    'src/monitor.ts',
    'src/protocol.ts',
    'src/types.ts',
    'src/utils.ts',
  ],
  format: ['cjs', 'esm'],
  splitting: true,
  dts: true,
});
