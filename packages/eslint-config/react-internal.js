const { resolve } = require("node:path");
const {
  REACT_CLASS_NAME_RESTRICTED_SYNTAX,
} = require("./react-tailwind.js");

const project = resolve(process.cwd(), "tsconfig.json");

/*
 * This is a custom ESLint configuration for use with
 * internal (bundled by their consumer) libraries
 * that utilize React.
 */

/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["eslint:recommended",  'plugin:@typescript-eslint/recommended', "prettier", "turbo"],
  plugins: ["jest"],
  globals: {
    React: true,
    JSX: true,
  },
  env: {
    browser: true,
    "jest/globals": true,
  },
  settings: {
    "import/resolver": {
      typescript: {
        project,
      },
    },
  },
  ignorePatterns: [
    // Ignore dotfiles
    ".*.js",
    "node_modules/",
    "dist/",
    "coverage/",
  ],
  rules: {
    "no-console": "error",
  },
  overrides: [
    // Force ESLint to detect .tsx files
    { files: ["*.js?(x)", "*.ts?(x)"] },
    {
      files: ["*.jsx", "*.tsx"],
      rules: {
        "no-restricted-syntax": ["error", ...REACT_CLASS_NAME_RESTRICTED_SYNTAX],
      },
    },
  ],
};
