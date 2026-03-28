const { resolve } = require('node:path');
const { REACT_CLASS_NAME_RESTRICTED_SYNTAX } = require('./react-tailwind.js');

const project = resolve(process.cwd(), 'tsconfig.json');

/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'turbo',
    'plugin:react-hooks/recommended',
  ],
  plugins: ['jest', 'unused-imports'],
  globals: {
    React: true,
    JSX: true,
  },
  env: {
    node: true,
    'jest/globals': true,
  },
  settings: {
    'import/resolver': {
      typescript: {
        project,
      },
    },
  },
  ignorePatterns: [
    // Ignore dotfiles
    '.*.js',
    'node_modules/',
    'dist/',
    'coverage/',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
      },
    ],
    'no-console': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],
  },
  overrides: [
    {
      files: ['*.js?(x)', '*.ts?(x)'],
    },
    {
      files: ['*.jsx', '*.tsx'],
      rules: {
        'no-restricted-syntax': [
          'error',
          ...REACT_CLASS_NAME_RESTRICTED_SYNTAX,
        ],
      },
    },
    {
      files: ['*.test.js?(x)', '*.test.ts?(x)'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
