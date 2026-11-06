import { useAuth } from "../../../app/providers";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { isDashboardRole } from "../lib/dashboard";
import { DashboardActivity } from "./DashboardActivity";
import { DashboardCarPipeline } from "./DashboardCarPipeline";
import { DashboardMetrics } from "./DashboardMetrics";
import { DashboardTrend } from "./DashboardTrend";
import { PageDataSkeleton } from "../../../components/ui/PageSkeletons";

export function DashboardPage() {
  const { roles } = useAuth();
  const canView = roles.some(isDashboardRole);
  const scope = roles.includes("admin") ? "system" : "assigned";
  const dashboard = useDashboardSummary(scope);

  if (!canView) {
    return (
      <div
        role="alert"
        className="max-w-[680px] border-y border-r border-l-4 border-[#7a1f1f] bg-[#f2e4e1] px-4 py-4"
      >
        <h1 className="font-serif text-2xl">You do not have access to dashboard metrics</h1>
        <p className="mt-2 text-sm leading-6 text-[#3f3b34]">
          Ask an administrator to review your account role. No operational metrics are shown.
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="border-b border-[#161512] pb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e]">
          Dashboard
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl leading-none tracking-tight sm:text-5xl">
              Operations at a glance
            </h1>
            <p className="mt-3 max-w-[62ch] text-sm leading-6 text-[#3f3b34]">
              Track completed imports, household review needs, CAR progress, and report issues.
            </p>
          </div>
          <span className="border border-[#2f5b3a] bg-[#e6ecdf] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#244b2e]">
            Updates automatically every 15 seconds
          </span>
        </div>
      </header>

      {dashboard.loading && !dashboard.summary ? (
        <PageDataSkeleton page="dashboard" />
      ) : dashboard.error && !dashboard.summary ? (
        <div role="alert" className="mt-5 border-l-4 border-[#7a1f1f] bg-[#f2e4e1] px-4 py-4">
          <p className="text-sm">{dashboard.error}</p>
          <button type="button" onClick={dashboard.reload} className="mt-3 underline">
            Try again
          </button>
        </div>
      ) : dashboard.summary ? (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
            <p className="font-semibold">
              {dashboard.summary.scope === "system" ? "Across the system" : "Your assigned work"}
            </p>
            <p className="text-[#5b574e]">Import trend · last 5 weeks</p>
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
