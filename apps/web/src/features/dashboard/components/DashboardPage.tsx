import { useAuth } from "../../../app/providers";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { isDashboardRole } from "../lib/dashboard";
import { DashboardActivity } from "./DashboardActivity";
import { DashboardCarPipeline } from "./DashboardCarPipeline";
import { DashboardMetrics } from "./DashboardMetrics";
import { DashboardTrend } from "./DashboardTrend";

export function DashboardPage() {
  const { roles } = useAuth();
  const canView = roles.some(isDashboardRole);
  const scope = roles.includes("admin") ? "system" : "assigned";
  const summary = useDashboardSummary(scope);

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
              Follow import volume, household review work, CAR progress, and document failures.
            </p>
          </div>
          <span className="border border-[#8a5a00] bg-[#f3ead8] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#704700]">
            Mock aggregates · no live records
          </span>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="font-semibold">{summary.scopeLabel}</p>
        <p className="text-[#5b574e]">Reporting window: Oct 1-29, 2026</p>
      </div>
      <p className="mt-2 border-l-4 border-[#8a5a00] bg-[#f3ead8] px-3 py-2 text-xs leading-5 text-[#704700]">
        Sample figures only. This UI is not connected to persisted records; production scope and
        metric access must be enforced by the server and database.
      </p>

      <DashboardMetrics summary={summary} />

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="grid gap-5">
          <DashboardTrend points={summary.importTrend} />
          <DashboardCarPipeline summary={summary} />
        </div>
        <DashboardActivity items={summary.recentActivity} />
      </div>
    </div>
  );
}
