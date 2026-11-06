import React from 'react';
import { Link } from 'react-router-dom';

type AuthLayoutProps = {
  /** Small mono label above the page headline. */
  eyebrow: string;
  /** Page headline (single <h1> for the page). */
  headline: string;
  /** One or two sentences under the headline. */
  lede: string;
  /** Short label above the headline inside the sign-in card. */
  cardLabel: string;
  /** Heading of the card itself (<h2>). */
  cardTitle: string;
  /** One-line description under the card heading. */
  cardDescription?: string;
  /** The form (or confirmation content) rendered inside the card. */
  children: React.ReactNode;
};

/**
 * Shared shell for the public account pages (sign in, reset password, set a
 * new password): site header, brand panel on the left, task card on the right,
 * site footer. Keeps the four public routes visually and structurally aligned
 * with the landing page and the app shell.
 */
export function AuthLayout({
  eyebrow,
  headline,
  lede,
  cardLabel,
  cardTitle,
  cardDescription,
  children,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f4f1ea] text-[#161512]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-[#161512] focus:bg-[#f4f1ea] focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <header className="border-b border-[#161512]">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-baseline gap-2" aria-label="Annex C home">
            <span className="font-serif text-xl leading-none tracking-tight">Annex C</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e] sm:inline">
              CAR management system
            </span>
          </Link>
          <Link
            to="/"
            className="text-sm underline underline-offset-4 decoration-[#8c877c] hover:decoration-[#161512] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main id="main" className="flex-1">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:py-16">
          {/* Brand panel — never carries account or case information. */}
          <section aria-labelledby="auth-headline">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#7a1f1f]">
              {eyebrow}
            </p>
            <h1
              id="auth-headline"
              className="mt-5 max-w-[16ch] font-serif text-4xl leading-[1.02] tracking-tight sm:text-5xl"
            >
              {headline}
            </h1>
            <p className="mt-5 max-w-[54ch] text-base leading-7 text-[#3f3b34]">{lede}</p>
            <p className="mt-8 max-w-[54ch] border-l-2 border-[#7a1f1f] pl-3 text-xs leading-5 text-[#5b574e]">
              Household and case information is confidential. Sign-in and download activity is
              recorded in the audit trail.
            </p>
          </section>

          {/* Task card — one job: complete this account action. */}
          <section
            aria-labelledby="auth-card-title"
            className="border border-[#161512] bg-[#fbf9f4] shadow-[0_1px_2px_rgba(22,21,18,0.06)]"
          >
            <div className="flex items-center justify-between border-b border-[#c9c3b6] px-6 py-4 sm:px-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5b574e]">
                {cardLabel}
              </p>
              <span aria-hidden="true" className="font-serif text-2xl leading-none text-[#7a1f1f]">
                C
              </span>
            </div>
            <div className="px-6 py-6 sm:px-8 sm:py-8">
              <h2 id="auth-card-title" className="font-serif text-2xl leading-tight tracking-tight">
                {cardTitle}
              </h2>
              {cardDescription && (
                <p className="mt-1.5 text-sm leading-6 text-[#5b574e]">{cardDescription}</p>
              )}
              <div className="mt-6">{children}</div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-[#c9c3b6]">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-[#5b574e] sm:px-6">
          <span>Annex C · CAR Management System</span>
          <span>For authorized staff use</span>
        </div>
      </footer>
    </div>
  );
}
