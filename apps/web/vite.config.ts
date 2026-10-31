import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  // Emit ES-module workers so the parser worker can code-split its dynamic
  // `import("xlsx")` instead of inlining everything into an IIFE bundle.
  worker: {
    format: 'es',
  },
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
      'src/features/review/__tests__/*.test.tsx',
      'src/features/templates/__tests__/*.test.tsx',
      'src/features/documents/__tests__/*.test.tsx',
      'src/features/dashboard/__tests__/*.test.tsx',
      'src/features/audit/__tests__/*.test.tsx',
    ],
    globals: true,
  },
})
