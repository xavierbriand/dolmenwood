import tseslint from 'typescript-eslint';
import globals from 'globals';
import js from '@eslint/js';
import security from 'eslint-plugin-security';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',

      // The security plugin is designed for web-facing apps. This project is
      // a local CLI / ETL tool with no user-supplied input reaching these
      // code paths.  Disable the rules that generate only false positives here
      // while keeping genuinely useful ones (eval, child-process, etc.).
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-regexp': 'off',

      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/assets/**',
                '**/assets',
                '../assets/**',
                '../../assets/**',
              ],
              message:
                'Direct import from @assets/ is strictly forbidden. Use Core ports or Data adapters.',
            },
          ],
        },
      ],
    },
    ignores: ['**/dist/**', '**/node_modules/**'],
  },

  // React / Ink adapter — packages/tui only.
  {
    files: ['packages/tui/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      // TypeScript covers prop typing; the new JSX transform needs no React import.
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      // Classic hook correctness rules. The rest of eslint-plugin-react-hooks@7's
      // recommended set is React-Compiler-oriented and out of scope here.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
