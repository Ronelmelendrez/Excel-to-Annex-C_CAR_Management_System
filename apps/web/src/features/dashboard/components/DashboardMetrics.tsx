import { DashboardMetric } from "./DashboardMetric";
import type { DashboardSummary } from "../types";

export function DashboardMetrics({ summary }: { summary: DashboardSummary }) {
  const metrics = [
    {
      id: "imports",
      label: "Imports committed",
      value: summary.importsCommitted,
      definition:
        "Count of committed import batches in this sample scope. Failed or uncommitted batches are excluded.",
    },
    {
      id: "rows",
      label: "Rows processed",
      value: summary.rowsProcessed,
      definition:
        "Sum of source rows in committed import batches. Failed or uncommitted batches contribute zero.",
    },
    {
      id: "households",
      label: "Households detected",
      value: summary.householdsDetected,
      definition:
        "Sum of households produced by committed import versions. A household in a later import version is counted again.",
    },
    {
      id: "grantee-issues",
      label: "Grantee issues",
      value: summary.granteeIssues,
      definition:
        "Households in committed imports with no single supported grantee flag, including blank, invalid, or conflicting flags.",
    },
    {
      id: "awaiting-review",
      label: "Awaiting CAR review",
      value: summary.awaitingReview,
      definition:
        "Latest CAR revisions currently in submitted status in this sample scope.",
    },
    {
      id: "export-failures",
      label: "Export failures",
      value: summary.exportFailures,
      definition:
        "Document export jobs in failed status in the October 2026 sample period. Each job is counted once.",
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
