import { defineConfig } from 'eslint/config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import {
  tsParser,
  js,
  FlatCompat,
} from '@arcanewizards/eslint-config/dependencies.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
]);
