import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `.claude` — чужие скрипты навыков, а не код приложения; они тянут за собой
  // два десятка ошибок и роняли бы линтер в деплое (.github/workflows/deploy.yml).
  globalIgnores(['dist', 'ios', 'build', '.claude']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Серверная часть выполняется в Node, не в браузере: обработчики api/ и
    // http-сервер, который их поднимает на нашем сервере вместо Vercel.
    files: ['api/**/*.js', 'server/**/*.js'],
    languageOptions: { globals: globals.node },
  },
])
