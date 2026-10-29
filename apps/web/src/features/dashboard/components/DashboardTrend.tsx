import { SectionCard } from "../../../components/ui/section-card";
import type { DashboardTrendPoint } from "../types";

export function DashboardTrend({ points }: { points: DashboardTrendPoint[] }) {
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const accessibleSummary = points
    .map((point) => `${point.label}: ${point.value.toLocaleString()} rows`)
    .join("; ");

  return (
    <SectionCard
      id="dashboard-import-trend"
      title="Import activity"
      description="Rows in committed imports by week · October 2026 sample"
      eyebrow="Volume"
    >
      {points.length === 0 ? (
        <p className="text-sm leading-6 text-[#5b574e]">
          No committed import activity is available in this scope yet.
        </p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`Committed import row trend. ${accessibleSummary}`}
            className="flex min-h-40 items-end justify-around gap-3 border-b border-[#8c877c] pb-2"
          >
            {points.map((point) => (
              <div key={point.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                <span className="font-mono text-xs tabular-nums">{point.value.toLocaleString()}</span>
                <div
                  aria-hidden="true"
                  className="w-full max-w-12 border border-[#704700] bg-[#e5d3ae]"
                  style={{ height: `${Math.max(4, (point.value / maxValue) * 112)}px` }}
                />
                <span className="text-center text-[10px] text-[#5b574e]">{point.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-[#5b574e]">
            Only committed rows are included. Uncommitted imports are excluded.
          </p>
        </>
      )}
    </SectionCard>
  );
}
