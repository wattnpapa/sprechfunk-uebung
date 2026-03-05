import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import sonarjs from "eslint-plugin-sonarjs";

export default tseslint.config(
    {
        ignores: [
            "dist/**",
            "node_modules/**",
            "coverage/**",
            "playwright-report/**",
            "test-results/**",
            "*.config.js",
            "*.config.mjs",
            ".eslintrc.js",
            ".eslintignore"
        ]
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.ts"],
        languageOptions: {
            parserOptions: {
                project: "./tsconfig.eslint.json",
                tsconfigRootDir: import.meta.dirname
            }
        },
        plugins: {
            sonarjs
        },
        rules: {
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            "max-lines": ["warn", { max: 400, skipBlankLines: true, skipComments: true }],
            "max-lines-per-function": ["warn", { max: 80, skipBlankLines: true, skipComments: true }],
            "complexity": ["warn", 10],
            "max-params": ["warn", 4],
            "sonarjs/cognitive-complexity": ["warn", 15],
            "sonarjs/max-switch-cases": ["warn", 10],
            "sonarjs/no-identical-functions": "warn"
        }
    },
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            globals: globals.browser
        }
    },
    {
        files: ["src/pdf/**/*.ts"],
        rules: {
            "max-params": ["warn", 6]
        }
    },
    {
        files: [
            "tests/**/*.ts",
            "e2e/**/*.ts",
            "scripts/**/*.mjs",
            "rollup.config.js",
            "playwright.config.ts",
            "vitest.config.ts"
        ],
        languageOptions: {
            globals: globals.node
        },
        linterOptions: {
            reportUnusedDisableDirectives: "off"
        },
        rules: {
            "max-lines": ["warn", { max: 1200, skipBlankLines: true, skipComments: true }],
            "max-lines-per-function": ["warn", { max: 500, skipBlankLines: true, skipComments: true }],
            "complexity": ["warn", 20],
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-empty-function": "off",
            "@typescript-eslint/no-useless-constructor": "off"
        }
    },
    eslintConfigPrettier
);
