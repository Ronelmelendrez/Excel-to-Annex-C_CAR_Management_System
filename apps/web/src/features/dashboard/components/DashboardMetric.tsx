import type { DashboardMetric as DashboardMetricData } from "../types";

export function DashboardMetric({
  metric,
  emphasis = false,
}: {
  metric: DashboardMetricData;
  emphasis?: boolean;
}) {
  const headingId = `dashboard-metric-${metric.id}`;

  return (
    <section aria-labelledby={headingId} className="border-t border-[#161512] pt-3">
      <div className="flex items-start justify-between gap-3">
        <h2
          id={headingId}
          className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5b574e]"
        >
          {metric.label}
        </h2>
        <details className="group relative">
          <summary className="min-h-[28px] cursor-pointer list-none text-xs font-medium text-[#5b574e] underline decoration-dotted underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]">
            Definition
          </summary>
          <p className="absolute right-0 z-10 mt-1 w-64 border border-[#8c877c] bg-[#f8f5ee] p-3 text-xs leading-5 text-[#3f3b34] shadow-sm group-open:block">
            {metric.definition}
          </p>
        </details>
      </div>
      <p className={`mt-2 font-serif text-3xl tabular-nums ${emphasis ? "text-[#7a1f1f]" : ""}`}>
        {metric.value.toLocaleString()}
      </p>
    </section>
  );
}
