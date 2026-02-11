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
