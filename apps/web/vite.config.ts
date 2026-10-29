import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@import-domain': fileURLToPath(
        new URL('../../supabase/functions/_shared/import-domain.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    include: [
      'src/features/auth/__tests__/*.test.{ts,tsx}',
      'src/features/imports/__tests__/*.test.{ts,tsx}',
      'src/features/households/__tests__/*.test.{ts,tsx}',
      'src/features/cars/__tests__/*.test.tsx',
    ],
    globals: true,
  },
})
