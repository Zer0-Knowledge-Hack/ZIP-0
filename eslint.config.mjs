import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/typechain-types/**",
      "**/artifacts/**",
      "**/cache/**",
      "**/node_modules/**",
      "**/.agents/**",
      "**/.claude/**",
      "**/.cursor/**",
      "**/.opencode/**",
      "**/.pi/**",
      "**/.hermes/**",
      "**/.github/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": "off",
    },
  },
];
