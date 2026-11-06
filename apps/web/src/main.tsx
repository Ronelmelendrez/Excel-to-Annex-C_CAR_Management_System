import React from 'react'
import ReactDOM from 'react-dom/client'
import { Router } from './app/router'
import { clearLocalImportData } from './shared/clear-local-import-data'
import { isSupabaseConfigured } from './shared/supabase'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)

function renderApplication() {
  if (!isSupabaseConfigured) {
    root.render(
      <main className="mx-auto mt-12 max-w-xl border border-[#7a1f1f] p-6 text-[#161512]">
        <h1 className="font-serif text-2xl">Supabase configuration required</h1>
        <p className="mt-3 text-sm leading-6">
          This production application requires a configured Supabase project. Set
          VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the deployment environment, then rebuild
          and redeploy the web app.
        </p>
      </main>,
    )
    return
  }

  root.render(
    <React.StrictMode>
      <Router />
    </React.StrictMode>,
  )
}

void clearLocalImportData()
  .then(renderApplication)
  .catch((cause: unknown) => {
    root.render(
      <main role="alert" className="mx-auto mt-12 max-w-xl border border-[#7a1f1f] p-6 text-[#7a1f1f]">
        <h1 className="font-serif text-2xl">Secure cleanup is blocked</h1>
        <p className="mt-3 text-sm leading-6">
          {cause instanceof Error
            ? cause.message
            : "Local import recovery data could not be cleared."}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 border border-[#7a1f1f] px-4 py-2 text-sm font-semibold"
        >
          Retry cleanup
        </button>
      </main>,
    )
  })
