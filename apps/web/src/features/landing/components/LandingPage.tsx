import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../../app/providers";

const workflows = [
  {
    number: "01",
    title: "Household register",
    description: "Search and inspect household records and their source details.",
  },
  {
    number: "02",
    title: "CAR workspace",
    description: "Prepare Case Assessment Reports using the Annex C report generator.",
  },
  {
    number: "03",
    title: "Operational oversight",
    description: "Follow system activity through role-restricted operational tools.",
  },
];

export function LandingPage() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f1ea] px-4 text-sm text-[#5b574e]">
        <p role="status">Checking your session…</p>
      </main>
    );
  }

  if (session) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#161512]">
      <header className="border-b border-[#161512]">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-baseline gap-2" aria-label="Annex C home">
            <span className="font-serif text-xl leading-none tracking-tight">Annex C</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e] sm:inline">
              CAR management system
            </span>
          </Link>
          <Link
            to="/login"
            className="border border-[#161512] px-4 py-2 text-sm font-medium hover:bg-[#161512] hover:text-[#f4f1ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
          >
            Staff sign in
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1180px] gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#7a1f1f]">
              Case Assessment Report · Annex C
            </p>
            <h1 className="mt-5 max-w-[14ch] font-serif text-5xl leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
              A clearer workspace for CAR operations.
            </h1>
            <p className="mt-6 max-w-[58ch] text-base leading-7 text-[#3f3b34]">
              Household records, case assessments and reporting tools come together in one
              workspace for authorized staff.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/login"
                className="inline-flex min-h-[48px] items-center border border-[#161512] bg-[#161512] px-5 py-3 text-sm font-semibold text-[#f4f1ea] hover:bg-[#7a1f1f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
              >
                Sign in to your workspace
                <span aria-hidden="true" className="ml-3 text-lg leading-none">
                  →
                </span>
              </Link>
              <a
                href="#workspace"
                className="px-1 py-2 text-sm underline underline-offset-4 decoration-[#8c877c] hover:decoration-[#161512] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
              >
                Explore the workspace
              </a>
            </div>
          </div>

          <aside
            aria-label="Workspace overview"
            className="relative overflow-hidden border border-[#161512] bg-[#ece7dc] p-6 sm:p-8"
          >
            <div
              aria-hidden="true"
              className="absolute -right-10 -top-14 h-48 w-48 rounded-full border border-[#c9c3b6]"
            />
            <div
              aria-hidden="true"
              className="absolute -right-2 -top-6 h-32 w-32 rounded-full border border-[#c9c3b6]"
            />
            <div className="relative">
              <div className="flex items-center justify-between border-b border-[#c9c3b6] pb-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5b574e]">
                  A connected workflow
                </p>
                <span className="font-serif text-3xl text-[#7a1f1f]">C</span>
              </div>
              <ol className="mt-5 space-y-0">
                {workflows.map((workflow, index) => (
                  <li
                    key={workflow.number}
                    className={`grid grid-cols-[2.5rem_1fr] gap-3 py-4 ${
                      index < workflows.length - 1 ? "border-b border-[#c9c3b6]" : ""
                    }`}
                  >
                    <span className="font-mono text-xs text-[#7a1f1f]">{workflow.number}</span>
                    <div>
                      <h2 className="font-serif text-xl leading-tight">{workflow.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-[#5b574e]">
                        {workflow.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-3 border-l-2 border-[#7a1f1f] pl-3 text-xs leading-5 text-[#5b574e]">
                Access is limited to accounts authorized for each part of the system.
              </p>
            </div>
          </aside>
        </section>

        <section id="workspace" className="border-y border-[#161512] bg-[#ece7dc]">
          <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[0.7fr_1.3fr] md:items-center">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e]">
                Built for accountable work
              </p>
              <h2 className="mt-2 font-serif text-3xl leading-tight">
                Keep case information in its proper place.
              </h2>
            </div>
            <p className="max-w-[72ch] text-sm leading-6 text-[#3f3b34]">
              Household and case information is confidential. Sign in with an authorized staff
              account to access the tools assigned to your role. Downloads and operational
              activity are subject to system controls.
            </p>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-[#5b574e] sm:px-6">
        <span>Annex C · CAR Management System</span>
        <span>For authorized staff use</span>
      </footer>
    </div>
  );
}
