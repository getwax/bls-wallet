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
  },
};
