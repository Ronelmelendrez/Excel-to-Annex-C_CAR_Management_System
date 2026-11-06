import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../../app/providers";
import { RouteLoadingSkeleton } from "../../../components/ui/PageSkeletons";
import { useScrolledPast } from "../../../shared/hooks";
import {
  ArrowRightIcon,
  CheckIcon,
  FileTextIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "../../../components/icons";

const workflows = [
  {
    number: "01",
    title: "Household register",
    description: "Search and inspect household records and their source details.",
    icon: UsersIcon,
  },
  {
    number: "02",
    title: "CAR workspace",
    description: "Prepare Case Assessment Reports using the Annex C report generator.",
    icon: FileTextIcon,
  },
  {
    number: "03",
    title: "Operational oversight",
    description: "Follow system activity through role-restricted operational tools.",
    icon: ShieldCheckIcon,
  },
];

const previewRows: Array<{ label: string; value: string; masked?: boolean; warning?: boolean }> = [
  { label: "Household ID", value: "••••••", masked: true },
  { label: "Grantee", value: "••••••", masked: true },
  { label: "Family composition", value: "✓ Complete" },
  { label: "Intervention plan", value: "⚠ 1 missing", warning: true },
  { label: "Recommendation", value: "✓ Complete" },
];

const safeguards = [
  {
    title: "Access is limited by role",
    description:
      "Each account only sees the tools its role allows, and restricted pages explain plainly when access is denied.",
  },
  {
    title: "Sensitive details stay masked",
    description:
      "Identifiers and other sensitive values stay hidden until you choose to reveal them — and every reveal is recorded.",
  },
  {
    title: "Activity is recorded",
    description:
      "Sign-ins, downloads and operational changes appear in the audit trail for administrators and auditors.",
  },
];

const trustPoints = ["Role-based access", "Masked sensitive fields", "Audited downloads"];

export function LandingPage() {
  const { session, loading } = useAuth();
  const condensed = useScrolledPast(24);

  if (loading) {
    return <RouteLoadingSkeleton pathname="/" />;
  }

  if (session) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f1ea] text-[#161512]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-[#161512] focus:bg-[#f4f1ea] focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <header
        className={`sticky top-0 z-40 border-b border-[#161512] bg-[#f4f1ea]/95 backdrop-blur transition-[padding,box-shadow] duration-200 ease-out supports-[backdrop-filter]:bg-[#f4f1ea]/80 ${
          condensed
            ? "py-2.5 shadow-[0_1px_0_0_rgba(22,21,18,0.08),0_8px_24px_-12px_rgba(22,21,18,0.35)]"
            : "py-4"
        }`}
      >
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="group flex items-baseline gap-2" aria-label="Annex C home">
            <span className="font-serif text-xl leading-none tracking-tight transition-colors duration-150 group-hover:text-[#7a1f1f]">
              Annex C
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e] sm:inline">
              CAR management system
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
            <a
              href="#workspace"
              className="text-sm text-[#3f3b34] underline-offset-4 hover:text-[#161512] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
            >
              Workspace
            </a>
            <a
              href="#safeguards"
              className="text-sm text-[#3f3b34] underline-offset-4 hover:text-[#161512] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
            >
              Privacy and access
            </a>
          </nav>

          <Link
            to="/login"
            className="inline-flex min-h-[40px] items-center gap-2 border border-[#161512] px-4 py-2 text-sm font-medium transition-colors duration-150 hover:bg-[#161512] hover:text-[#f4f1ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
          >
            Staff sign in
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-[1180px] gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <p
              className="motion-safe:animate-fade-up font-mono text-[10px] uppercase tracking-[0.2em] text-[#7a1f1f]"
              style={{ animationDelay: "60ms" }}
            >
              Case Assessment Report · Annex C
            </p>
            <h1
              className="motion-safe:animate-fade-up mt-5 max-w-[14ch] font-serif text-5xl leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl"
              style={{ animationDelay: "120ms" }}
            >
              A clearer workspace for CAR operations.
            </h1>
            <p
              className="motion-safe:animate-fade-up mt-6 max-w-[56ch] text-base leading-7 text-[#3f3b34] sm:text-lg sm:leading-8"
              style={{ animationDelay: "180ms" }}
            >
              Household records, case assessments and reporting tools come together in one
              workspace for authorized staff.
            </p>

            <div
              className="motion-safe:animate-fade-up mt-8 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "240ms" }}
            >
              <Link
                to="/login"
                className="group inline-flex min-h-[48px] items-center gap-3 border border-[#161512] bg-[#161512] px-5 py-3 text-sm font-semibold text-[#f4f1ea] transition-colors duration-150 hover:bg-[#7a1f1f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
              >
                Sign in to your workspace
                <ArrowRightIcon className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
              </Link>
              <a
                href="#workspace"
                className="inline-flex min-h-[48px] items-center border border-[#c9c3b6] bg-[#fbf9f4] px-5 py-3 text-sm font-semibold transition-colors duration-150 hover:border-[#161512] hover:bg-[#ece7dc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
              >
                Explore the workspace
              </a>
            </div>

            <ul
              className="motion-safe:animate-fade-up mt-8 flex flex-wrap gap-x-6 gap-y-2"
              style={{ animationDelay: "300ms" }}
            >
              {trustPoints.map((point) => (
                <li key={point} className="flex items-center gap-2 text-xs text-[#5b574e]">
                  <CheckIcon className="h-4 w-4 text-[#7a1f1f]" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Report preview — a stylised, data-free glimpse of the CAR editor. */}
          <aside
            aria-label="Annex C report preview"
            className="motion-safe:animate-fade-up relative"
            style={{ animationDelay: "200ms" }}
          >
            <div
              aria-hidden="true"
              className="absolute -right-8 -top-10 hidden h-44 w-44 rounded-full border border-[#e2ddd1] sm:block"
            />
            <div className="relative border border-[#161512] bg-[#fbf9f4] shadow-[0_1px_2px_rgba(22,21,18,0.06),0_24px_48px_-32px_rgba(22,21,18,0.55)]">
              <div className="flex items-center justify-between gap-4 border-b border-[#c9c3b6] px-5 py-3.5 sm:px-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5b574e]">
                  Annex C · Report preview
                </p>
                <span className="border border-[#7a1f1f] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#7a1f1f]">
                  Draft
                </span>
              </div>

              <div className="px-5 py-5 sm:px-6 sm:py-6">
                <p className="font-serif text-2xl leading-tight tracking-tight">
                  Case Assessment Report
                </p>

                <dl className="mt-4 border-t border-[#e2ddd1]">
                  {previewRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-4 border-b border-[#e2ddd1] py-3 last:border-b-0"
                    >
                      <dt className="text-sm text-[#5b574e]">{row.label}</dt>
                      <dd
                        className={`text-sm font-medium ${
                          row.masked
                            ? "tracking-[0.18em] text-[#8c877c]"
                            : row.warning
                              ? "text-[#b45309]"
                              : "text-[#161512]"
                        }`}
                      >
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-4 border-l-2 border-[#7a1f1f] pl-3 text-xs leading-5 text-[#5b574e]">
                  Sensitive values stay masked until you choose to reveal them — and every reveal
                  is recorded.
                </p>
              </div>
            </div>
          </aside>
        </section>

        {/* Workflow */}
        <section
          id="workspace"
          aria-labelledby="workspace-title"
          className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6 sm:py-20"
        >
          <div className="max-w-[60ch]">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7a1f1f]">
              A connected workflow
            </p>
            <h2
              id="workspace-title"
              className="motion-safe:animate-fade-up mt-3 font-serif text-3xl leading-tight tracking-tight sm:text-4xl"
            >
              One workspace, three jobs.
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#5b574e] sm:text-base sm:leading-7">
              Everything is grouped by the work in front of you — no hunting through folders or
              spreadsheets to find the current version.
            </p>
          </div>

          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {workflows.map((workflow, index) => {
              const Icon = workflow.icon;
              return (
                <li
                  key={workflow.number}
                  className="motion-safe:animate-fade-up group flex flex-col border border-[#c9c3b6] bg-[#fbf9f4] p-6 transition duration-200 ease-out hover:-translate-y-1 hover:border-[#161512] hover:shadow-[0_18px_36px_-24px_rgba(22,21,18,0.6)]"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-11 w-11 items-center justify-center border border-[#c9c3b6] bg-white text-[#7a1f1f] transition-colors duration-200 group-hover:border-[#7a1f1f]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-xs text-[#8c877c]">{workflow.number}</span>
                  </div>
                  <h3 className="mt-5 font-serif text-xl leading-tight">{workflow.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#5b574e]">{workflow.description}</p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Safeguards */}
        <section
          id="safeguards"
          aria-labelledby="safeguards-title"
          className="border-y border-[#161512] bg-[#ece7dc]"
        >
          <div className="mx-auto grid max-w-[1180px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-16">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e]">
                Built for accountable work
              </p>
              <h2
                id="safeguards-title"
                className="mt-3 font-serif text-3xl leading-tight tracking-tight sm:text-4xl"
              >
                Keep case information in its proper place.
              </h2>
              <p className="mt-4 max-w-[52ch] text-sm leading-6 text-[#3f3b34] sm:text-base sm:leading-7">
                Household and case information is confidential. Sign in with an authorized staff
                account to access the tools assigned to your role. Downloads and operational
                activity are subject to system controls.
              </p>
            </div>

            <ul className="grid gap-4">
              {safeguards.map((item) => (
                <li
                  key={item.title}
                  className="flex gap-3 border border-[#c9c3b6] bg-[#fbf9f4] p-4 sm:p-5"
                >
                  <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#7a1f1f]" />
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#5b574e]">{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Closing call to action */}
        <section aria-labelledby="cta-title" className="bg-[#161512] text-[#f4f1ea]">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between md:py-16">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#c9c3b6]">
                Ready when you are
              </p>
              <h2
                id="cta-title"
                className="mt-3 max-w-[18ch] font-serif text-3xl leading-tight tracking-tight sm:text-4xl"
              >
                Open your workspace.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/login"
                className="group inline-flex min-h-[48px] items-center gap-3 border border-[#f4f1ea] bg-[#f4f1ea] px-5 py-3 text-sm font-semibold text-[#161512] transition-colors duration-150 hover:border-[#7a1f1f] hover:bg-[#7a1f1f] hover:text-[#f4f1ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f1ea]"
              >
                Sign in to continue
                <ArrowRightIcon className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
              </Link>
              <a
                href="#workspace"
                className="inline-flex min-h-[48px] items-center border border-[#5b574e] px-5 py-3 text-sm font-semibold text-[#f4f1ea] transition-colors duration-150 hover:border-[#f4f1ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f1ea]"
              >
                See what it does
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#c9c3b6]">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-[#5b574e] sm:px-6">
          <span>Annex C · CAR Management System</span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a
              href="#safeguards"
              className="underline-offset-4 hover:text-[#161512] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
            >
              Privacy and access
            </a>
            <Link
              to="/login"
              className="underline-offset-4 hover:text-[#161512] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
            >
              Sign in
            </Link>
            <span>For authorized staff use</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
