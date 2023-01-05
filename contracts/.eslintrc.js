module.exports = {
  env: {
    browser: true,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "standard",
    "plugin:prettier/recommended",
    "plugin:node/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    "node/no-unsupported-features/es-syntax": [
      "error",
      {
        version: ">=16.0.0",
        ignores: ["modules"],
      },
    ],
    "node/no-missing-import": "off",

    // False-positives in typescript
    "no-useless-constructor": "off",

    "node/no-unsupported-features/node-builtins": [
      "error",
      {
        version: ">=16.0.0",
        ignores: [],
      },
    ],
    // TODO (merge-ok) Remove and fix lint error
    "node/no-unpublished-import": ["warn"],
    // https://github.com/typescript-eslint/typescript-eslint/blob/main/docs/linting/TROUBLESHOOTING.md#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
    "no-undef": "off",
  },
  overrides: [
    {
      // chai expect statements
      files: ["*.test.ts"],
      rules: {
        "no-unused-expressions": "off",
      },
    },
  ],
};
