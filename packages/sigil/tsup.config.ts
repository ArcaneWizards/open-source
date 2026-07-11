import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/frontend.ts',
    'src/frontend/alert.tsx',
    'src/frontend/appearance.tsx',
    'src/frontend/context.tsx',
    'src/frontend/controls/index.ts',
    'src/frontend/dialogs.tsx',
    'src/frontend/input.ts',
    'src/frontend/preferences.ts',
    'src/frontend/spinner.tsx',
    'src/frontend/styling.ts',
    'src/frontend/styling.hooks.ts',
    'src/frontend/toolbars.tsx',
    'src/frontend/tooltip.tsx',
    'src/frontend/updates.tsx',
    'src/frontend/user-actions.tsx',
    'src/frontend/utils.tsx',
    'src/updates.tsx',
    'src/shared/config.ts',
  ],
  format: ['cjs', 'esm'],
  splitting: true,
  dts: true,
  external: [],
});
