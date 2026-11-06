import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, CheckIcon } from '../../../components/icons';

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

/** Same assurances the landing page leads with — no account or case data. */
const trustPoints = ['Role-based access', 'Masked sensitive fields', 'Audited downloads'];

/**
 * Shared shell for the public account pages (sign in, reset password, set a
 * new password): site header, brand panel on the left, task card on the right,
 * site footer. Structurally and visually mirrors the landing page — same
 * split hero grid, headline scale, trust chips and report-preview card.
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

      <header className="sticky top-0 z-40 border-b border-[#161512] bg-[#f4f1ea]/95 backdrop-blur supports-[backdrop-filter]:bg-[#f4f1ea]/80">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="group flex items-baseline gap-2" aria-label="Annex C home">
            <span className="font-serif text-xl leading-none tracking-tight transition-colors duration-150 group-hover:text-[#7a1f1f]">
              Annex C
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e] sm:inline">
              CAR management system
            </span>
          </Link>

          <Link
            to="/"
            className="group inline-flex min-h-[40px] items-center gap-2 border border-[#161512] px-4 py-2 text-sm font-medium transition-colors duration-150 hover:bg-[#161512] hover:text-[#f4f1ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
          >
            <ArrowLeftIcon className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-1" />
            Back to home
          </Link>
        </div>
      </header>

      <main id="main" className="flex-1">
        <div className="mx-auto grid max-w-[1180px] gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:py-24">
          {/* Brand panel — never carries account or case information. */}
          <section
            aria-labelledby="auth-headline"
            className="motion-safe:animate-fade-up"
            style={{ animationDelay: '60ms' }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#7a1f1f]">
              {eyebrow}
            </p>
            <h1
              id="auth-headline"
              className="mt-5 max-w-[15ch] font-serif text-5xl leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl"
            >
              {headline}
            </h1>
            <p className="mt-6 max-w-[56ch] text-base leading-7 text-[#3f3b34] sm:text-lg sm:leading-8">
              {lede}
            </p>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {trustPoints.map((point) => (
                <li key={point} className="flex items-center gap-2 text-xs text-[#5b574e]">
                  <CheckIcon className="h-4 w-4 text-[#7a1f1f]" />
                  {point}
                </li>
              ))}
            </ul>

            <p className="mt-8 max-w-[54ch] border-l-2 border-[#7a1f1f] pl-3 text-xs leading-5 text-[#5b574e]">
              Household and case information is confidential. Sign-in and download activity is
              recorded in the audit trail.
            </p>
          </section>

          {/* Task card — one job: complete this account action. */}
          <section
            aria-labelledby="auth-card-title"
            className="motion-safe:animate-fade-up relative"
            style={{ animationDelay: '200ms' }}
          >
            <div
              aria-hidden="true"
              className="absolute -right-4 -top-10 hidden h-44 w-44 rounded-full border border-[#e2ddd1] sm:block"
            />
            <div className="relative border border-[#161512] bg-[#fbf9f4] shadow-[0_1px_2px_rgba(22,21,18,0.06),0_24px_48px_-32px_rgba(22,21,18,0.55)]">
              <div className="flex items-center justify-between gap-4 border-b border-[#c9c3b6] px-5 py-3.5 sm:px-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5b574e]">
                  {cardLabel}
                </p>
                <span aria-hidden="true" className="font-serif text-2xl leading-none text-[#7a1f1f]">
                  C
                </span>
              </div>
              <div className="px-5 py-5 sm:px-6 sm:py-6">
                <h2 id="auth-card-title" className="font-serif text-2xl leading-tight tracking-tight">
                  {cardTitle}
                </h2>
                {cardDescription && (
                  <p className="mt-1.5 text-sm leading-6 text-[#5b574e]">{cardDescription}</p>
                )}
                <div className="mt-6">{children}</div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-[#c9c3b6]">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-[#5b574e] sm:px-6">
          <span>Annex C · CAR Management System</span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              to="/#safeguards"
              className="underline-offset-4 hover:text-[#161512] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
            >
              Privacy and access
            </Link>
            <span>For authorized staff use</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
