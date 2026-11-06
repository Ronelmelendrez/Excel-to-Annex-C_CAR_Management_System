import { DashboardMetric } from "./DashboardMetric";
import type { DashboardSummary } from "../types";

export function DashboardMetrics({ summary }: { summary: DashboardSummary }) {
  const metrics = [
    {
      id: "imports",
      label: "Completed imports",
      value: summary.importsCommitted,
      definition:
        "Number of successful imports in your assigned area or across the system. Unfinished and unsuccessful imports are not included.",
    },
    {
      id: "rows",
      label: "Rows included",
      value: summary.rowsProcessed,
      definition:
        "Number of spreadsheet rows included in completed imports in the selected area.",
    },
    {
      id: "households",
      label: "Household records",
      value: summary.householdsDetected,
      definition:
        "Number of household entries in completed imports. The same household may appear more than once if included in separate imports.",
    },
    {
      id: "grantee-issues",
      label: "Households needing grantee review",
      value: summary.granteeIssues,
      definition:
        "Households in completed imports without a confirmed grantee.",
    },
    {
      id: "awaiting-review",
      label: "CARs awaiting review",
      value: summary.awaitingReview,
      definition:
        "Most recent CAR versions submitted for review in the selected area.",
    },
    {
      id: "export-failures",
      label: "Report generation issues",
      value: summary.exportFailures,
      definition:
        "Reports that could not be generated in the selected area.",
    },
  ];

  return (
    <section
      aria-label="Operational metrics"
      className="grid gap-x-6 gap-y-5 border-b border-[#c9c3b6] py-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      {metrics.map((metric) => (
        <DashboardMetric
          key={metric.id}
          metric={metric}
          emphasis={metric.id === "grantee-issues" || metric.id === "export-failures"}
        />
      ))}
    </section>
  );
}
