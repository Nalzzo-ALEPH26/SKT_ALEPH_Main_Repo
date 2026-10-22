import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'),
      'server-only': resolve(process.cwd(), 'tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: [
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.test.tsx',
      'tests/components/**/*.test.ts',
      'tests/components/**/*.test.tsx',
    ],
  },
})
