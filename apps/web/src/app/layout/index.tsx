import React from 'react';
import { cn } from '../../lib/utils';
import { AppHeader } from './AppHeader';
import { shellContainer } from './shell';

/**
 * Authenticated app frame: skip link, sticky header, scrolling main content
 * and a footer pinned to the bottom of the viewport on short pages.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f4f1ea] text-[#161512]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-[#161512] focus:bg-[#f4f1ea] focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <AppHeader />

      <main id="main" className={cn(shellContainer, 'flex-1 py-8 sm:py-10')}>
        {children}
      </main>

      <footer className="border-t border-[#c9c3b6]">
        <div
          className={cn(
            shellContainer,
            'flex flex-wrap items-center justify-between gap-x-8 gap-y-2 py-6 text-xs text-[#5b574e]',
          )}
        >
          <span className="font-mono uppercase tracking-[0.18em]">Annex C · CAR register</span>
          <p className="max-w-[64ch] leading-5">
            Household data is confidential. Downloads are logged. Do not forward workbooks or
            reports outside authorised staff.
          </p>
        </div>
      </footer>
    </div>
  );
}
