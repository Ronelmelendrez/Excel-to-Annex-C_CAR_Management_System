import { useAuth } from "../../../app/providers";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { isDashboardRole } from "../lib/dashboard";
import { AlertTriangleIcon } from "../../../components/icons";
import { DashboardActivity } from "./DashboardActivity";
import { DashboardCarPipeline } from "./DashboardCarPipeline";
import { DashboardMetrics } from "./DashboardMetrics";
import { DashboardTrend } from "./DashboardTrend";
import { PageDataSkeleton } from "../../../components/ui/PageSkeletons";

export function DashboardPage() {
  const { roles, user } = useAuth();
  const canView = roles.some(isDashboardRole);
  const scope = roles.includes("admin") ? "system" : "assigned";
  const dashboard = useDashboardSummary(scope, user?.id ?? "");

  if (!canView) {
    return (
      <div
        role="alert"
        className="flex max-w-[680px] items-start gap-3 border-l-4 border-[#7a1f1f] bg-[#f6eaea] px-4 py-4"
      >
        <AlertTriangleIcon className="mt-1 h-5 w-5 shrink-0 text-[#7a1f1f]" />
        <div>
          <h1 className="font-serif text-2xl leading-tight">
            You do not have access to dashboard metrics
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#3f3b34]">
            Ask an administrator to review your account role. No operational metrics are shown.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="border-b border-[#161512] pb-5">
        <p
          className="motion-safe:animate-fade-up font-mono text-[10px] uppercase tracking-[0.2em] text-[#7a1f1f]"
        >
          Dashboard
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1
              className="motion-safe:animate-fade-up font-serif text-4xl leading-none tracking-tight sm:text-5xl"
              style={{ animationDelay: "60ms" }}
            >
              Operations at a glance
            </h1>
            <p
              className="motion-safe:animate-fade-up mt-3 max-w-[62ch] text-sm leading-6 text-[#3f3b34]"
              style={{ animationDelay: "120ms" }}
            >
              Track completed imports, household review needs, CAR progress, and report issues.
            </p>
          </div>
          <span
            className="motion-safe:animate-fade-up inline-flex items-center gap-2 border border-[#161512] bg-[#fbf9f4] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#161512]"
            style={{ animationDelay: "180ms" }}
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 bg-[#7a1f1f] motion-safe:animate-pulse"
            />
            Updates automatically every 15 seconds
          </span>
        </div>
      </header>

      {dashboard.loading && !dashboard.summary ? (
        <PageDataSkeleton page="dashboard" />
      ) : dashboard.error && !dashboard.summary ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2 border-l-4 border-[#7a1f1f] bg-[#f6eaea] px-4 py-4"
        >
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#7a1f1f]" />
          <div>
            <p className="text-sm">{dashboard.error}</p>
            <button
              type="button"
              onClick={dashboard.reload}
              className="mt-3 underline underline-offset-4 hover:text-[#7a1f1f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
            >
              Try again
            </button>
          </div>
        </div>
      ) : dashboard.summary ? (
        <>
          {/* Scope band — mirrors the landing page's full-bleed section band. */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-y border-[#161512] bg-[#ece7dc] px-4 py-2.5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#161512]">
              {dashboard.summary.scope === "system" ? "Across the system" : "Your assigned work"}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5b574e]">
              Import trend · last 5 weeks
            </p>
          </div>
          {dashboard.error && (
            <p role="status" className="mt-2 text-xs text-[#7a1f1f]">
              {dashboard.error} Showing the last successful data.
            </p>
          )}
          <DashboardMetrics summary={dashboard.summary} />

          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="grid gap-5">
              <DashboardTrend points={dashboard.summary.importTrend} />
              <DashboardCarPipeline summary={dashboard.summary} />
            </div>
            <DashboardActivity items={dashboard.summary.recentActivity} />
          </div>
        </>
      ) : null}
    </div>
  );
}
