import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const browserAndNodeGlobals = Object.fromEntries(
  [
    'Blob',
    'Buffer',
    'File',
    'IDBDatabase',
    'IDBFactory',
    'IDBObjectStore',
    'IDBOpenDBRequest',
    'IDBRequest',
    'IDBTransaction',
    'RTCPeerConnection',
    'URL',
    'URLSearchParams',
    'atob',
    'btoa',
    'clearTimeout',
    'console',
    'crypto',
    'document',
    'fetch',
    'globalThis',
    'indexedDB',
    'navigator',
    'process',
    'setTimeout',
    'window',
  ].map((name) => [name, 'readonly'])
);

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'packages/cli/templates/**',
      '**/coverage/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['packages/*/src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: browserAndNodeGlobals,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-useless-assignment': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
