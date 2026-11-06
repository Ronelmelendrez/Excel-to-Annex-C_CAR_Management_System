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
        <h1 className="font-serif text-2xl">The system is temporarily unavailable</h1>
        <p className="mt-3 text-sm leading-6">
          Please try again later. If the problem continues, contact your system administrator.
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
    console.error('Unable to clear saved import data before startup.', cause)
    root.render(
      <main role="alert" className="mx-auto mt-12 max-w-xl border border-[#7a1f1f] p-6 text-[#7a1f1f]">
        <h1 className="font-serif text-2xl">The system could not complete a security check</h1>
        <p className="mt-3 text-sm leading-6">
          The system could not safely open your workspace. Refresh the page to try again. If the
          problem continues, contact your system administrator.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 border border-[#7a1f1f] px-4 py-2 text-sm font-semibold"
        >
          Refresh and try again
        </button>
      </main>,
    )
  })
