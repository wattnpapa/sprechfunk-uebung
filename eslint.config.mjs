// Polyfill for structuredClone in older Node versions
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
  // Globale Ignorierungen
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.config.js', '*.config.mjs', '.eslintrc.js', '.eslintignore'],
  },
  
  // Basis-Konfigurationen
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,

  // Spezifische Regeln
  {
    plugins: {
      '@stylistic': stylistic,
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript Strenge
      '@typescript-eslint/no-explicit-any': 'warn', // Warnung statt Error, da wir noch einige 'any' haben
      '@typescript-eslint/explicit-function-return-type': 'off', // Inferenz ist oft gut genug
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'warn', // ! Operator sparsam nutzen
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'], // Interfaces bevorzugen

      // Stylistic (Formatierung)
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/quotes': ['error', 'double'],
      '@stylistic/indent': ['error', 4, { "SwitchCase": 1 }],
      '@stylistic/comma-dangle': ['error', 'never'],
      '@stylistic/arrow-parens': ['error', 'as-needed'],
      '@stylistic/brace-style': ['error', '1tbs'],
      
      // Best Practices
      'no-console': ['warn', { allow: ['warn', 'error'] }], // console.log vermeiden
      'eqeqeq': ['error', 'always'], // === statt ==
      'curly': ['error', 'all'], // {} immer nutzen
    },
  }
);
