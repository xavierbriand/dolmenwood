import tseslint from 'typescript-eslint';
import globals from 'globals';
import js from '@eslint/js';
import security from 'eslint-plugin-security';

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
);
