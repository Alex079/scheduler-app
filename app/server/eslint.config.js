import js from '@eslint/js'
import globals from 'globals'

export default [
  {
    ignores: ['node_modules/', 'dist/'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Logging is core to the server's operation (event runner, refresher).
      'no-console': 'off',
    },
  },
]
