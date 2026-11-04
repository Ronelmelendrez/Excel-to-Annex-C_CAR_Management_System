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
      '@report-template': fileURLToPath(
        new URL('../../supabase/functions/_shared/report-template.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    // The suite always runs against the local mock backend. A developer's
    // .env.local may point at a live Supabase project, so the credentials are
    // cleared here: tests must never read or write real data.
    env: {
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
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
    // Rendering the full Annex C document (60+ slots, three tables) in jsdom
    // is slow, and parallel test files slow it further — the default 5s is
    // not enough for the CAR page suites.
    testTimeout: 20000,
  },
})
