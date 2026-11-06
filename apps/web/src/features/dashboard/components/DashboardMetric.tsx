import type { DashboardMetric as DashboardMetricData } from "../types";

type DashboardMetricProps = {
  metric: DashboardMetricData;
  emphasis?: boolean;
  /**
   * `tile` — bordered landing-style card with a hover lift (metrics grid).
   * `row` — editorial rule row for metrics shown inside a panel (CAR pipeline).
   */
  variant?: "tile" | "row";
  /** Entrance delay (ms) for the landing-style `fade-up` animation (tiles only). */
  delay?: number;
};

function Definition({ definition }: { definition: string }) {
  return (
    <details className="group relative shrink-0">
      <summary className="min-h-[28px] cursor-pointer list-none text-xs font-medium text-[#5b574e] underline decoration-dotted underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]">
        Definition
      </summary>
      <p className="absolute right-0 z-10 mt-1 w-64 border border-[#161512] bg-[#f4f1ea] p-3 text-xs leading-5 text-[#3f3b34] shadow-[0_1px_2px_rgba(22,21,18,0.06),0_24px_48px_-32px_rgba(22,21,18,0.55)] group-open:block">
        {definition}
      </p>
    </details>
  );
}

export function DashboardMetric({
  metric,
  emphasis = false,
  variant = "tile",
  delay,
}: DashboardMetricProps) {
  const headingId = `dashboard-metric-${metric.id}`;
  const valueClass = `font-serif text-3xl tabular-nums ${emphasis ? "text-[#7a1f1f]" : ""}`;

  if (variant === "row") {
    return (
      <section aria-labelledby={headingId} className="border-t border-[#161512] pt-3">
        <div className="flex items-start justify-between gap-3">
          <h2
            id={headingId}
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5b574e]"
          >
            {metric.label}
          </h2>
          <Definition definition={metric.definition} />
        </div>
        <p className={`mt-2 ${valueClass}`}>{metric.value.toLocaleString()}</p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className="group motion-safe:animate-fade-up flex flex-col border border-[#c9c3b6] bg-[#fbf9f4] p-4 transition duration-200 ease-out hover:-translate-y-1 hover:border-[#161512] hover:shadow-[0_18px_36px_-24px_rgba(22,21,18,0.6)] sm:p-5"
      style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <h2
          id={headingId}
          className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5b574e]"
        >
          {metric.label}
        </h2>
        <Definition definition={metric.definition} />
      </div>
      <p className={`mt-auto pt-3 ${valueClass}`}>{metric.value.toLocaleString()}</p>
    </section>
  );
}
