import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

/**
 * Vite only honours `?inline` for assets at build time — in dev and under
 * vitest the import resolves to a bare URL, which the browser/tests cannot
 * decode. This plugin answers `*.docx?inline` with a data-URI module in every
 * mode, so `annex-c-docx.ts` always receives the same base64 payload.
 */
function inlineDocx(): Plugin {
  return {
    name: 'inline-docx',
    enforce: 'pre',
    load(id) {
      if (!id.includes('.docx?inline')) return null
      const file = id.split('?')[0]
      const base64 = readFileSync(file).toString('base64')
      const uri = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`
      return `export default ${JSON.stringify(uri)}`
    },
  }
}

export default defineConfig({
  plugins: [inlineDocx(), react()],
  // .docx is not a built-in asset type; the Annex C template is imported with
  // `?inline` (data URI) so it ships inside the bundle — no runtime fetch.
  assetsInclude: ['**/*.docx'],
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
      'src/features/templates/__tests__/*.test.{ts,tsx}',
      'src/features/dashboard/__tests__/*.test.tsx',
      'src/features/dashboard/__tests__/api.test.ts',
      'src/features/audit/__tests__/*.test.tsx',
    ],
    globals: true,
    // Rendering the full Annex C document (60+ slots, three tables) in jsdom
    // is slow, and parallel test files slow it further — the default 5s is
    // not enough for the CAR page suites.
    testTimeout: 20000,
  },
})
