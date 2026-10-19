import js from '@eslint/js';
import globals from 'globals';

/**
 * ESLint flat config for the CodeHub API.
 *
 * Deliberately narrow: this codebase is plain ES modules with no framework
 * magic, so the rules that earn their keep are unused variables, accidental
 * `console` calls outside the logger, and unsafe equality.
 */
export default [
  { ignores: ['node_modules/**', 'coverage/**', 'tmp/**'] },

  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2021 },
    },
    rules: {
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // utils/logger.js is the only place that should touch console directly.
      'no-console': 'error',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-return-await': 'error',
      /**
       * `require-await` is off on purpose: several functions here are async
       * because they implement an async contract (snapshot stores, mail senders,
       * fetchers in tests), not because they personally await something.
       */
      'require-await': 'off',
      'object-shorthand': 'warn',
    },
  },

  {
    // The logger IS the console wrapper, and scripts talk to the operator.
    files: ['utils/logger.js', 'scripts/**/*.js', 'services/email.service.js', 'config/env.js'],
    rules: { 'no-console': 'off' },
  },

  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: { 'no-console': 'off' },
  },
];
