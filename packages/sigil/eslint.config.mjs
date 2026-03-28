import { defineConfig } from 'eslint/config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import {
  tsParser,
  js,
  FlatCompat,
} from '@arcanewizards/eslint-config/dependencies.js';
import eslintPluginBetterTailwindcss from 'eslint-plugin-better-tailwindcss';
import reactTailwindConfig from '@arcanewizards/eslint-config/react-tailwind.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { REACT_TAILWIND_CALLEES } = reactTailwindConfig;

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  {
    extends: compat.extends('@arcanewizards/eslint-config/library.js'),

    languageOptions: {
      parser: tsParser,
    },
  },
  {
    extends: [eslintPluginBetterTailwindcss.configs.recommended],
    settings: {
      'better-tailwindcss': {
        entryPoint: './src/frontend/styles/sigil.css',
        tsconfig: './tsconfig.json',
        callees: REACT_TAILWIND_CALLEES,
      },
    },
    rules: {
      'better-tailwindcss/enforce-consistent-line-wrapping': 'error',
      'better-tailwindcss/no-unknown-classes': 'error',
    },
  },
]);
