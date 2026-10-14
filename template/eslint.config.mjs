// @ts-check

import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import moduleLoggerName from "./eslint-rules/module-logger-name.mjs";

export default defineConfig(
  {
    ignores: [
      "**/dist/",
      "**/node_modules/",
      "**/.wrangler/",
      "apps/backend/public/",
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
      },
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        module: "writable",
        require: "readonly",
        exports: "writable",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
  },
  {
    files: ["apps/backend/src/**/*.ts", "libs/*/src/**/*.ts"],
    plugins: { local: moduleLoggerName },
    rules: {
      "local/module-logger-name": "error",
    },
  },
  {
    // Server code logs through @lib/logging, which is the one place that
    // configures LogTape and reaches the console.
    files: ["apps/backend/src/**/*.ts", "libs/*/src/**/*.ts"],
    ignores: [
      "libs/logging/src/**",
      "libs/server-commons/src/http-logger-middleware.ts",
    ],
    rules: {
      "no-console": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@logtape/*"],
              message:
                'Log through @lib/logging (moduleLogger("<package>/<file>")) instead of importing LogTape directly.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.tsx", "**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='React']",
          message: "Use named imports from 'react' instead of React.xxx.",
        },
      ],
    },
  },
  eslintConfigPrettier,
);
