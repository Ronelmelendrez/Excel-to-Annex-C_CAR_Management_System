import { DashboardMetric } from "./DashboardMetric";
import type { DashboardSummary } from "../types";

export function DashboardMetrics({ summary }: { summary: DashboardSummary }) {
  const metrics = [
    {
      id: "imports",
      label: "Imports committed",
      value: summary.importsCommitted,
      definition:
        "Count of committed import batches in your assigned scope or across the system. Failed and uncommitted imports are excluded.",
    },
    {
      id: "rows",
      label: "Rows processed",
      value: summary.rowsProcessed,
      definition:
        "Sum of source rows in committed import batches in the selected scope.",
    },
    {
      id: "households",
      label: "Households detected",
      value: summary.householdsDetected,
      definition:
        "Household records in committed imports. A household in a later import version is counted again.",
    },
    {
      id: "grantee-issues",
      label: "Grantee issues",
      value: summary.granteeIssues,
      definition:
        "Household records in committed imports without a valid grantee status.",
    },
    {
      id: "awaiting-review",
      label: "Awaiting CAR review",
      value: summary.awaitingReview,
      definition:
        "Latest CAR revisions currently in submitted status in the selected scope.",
    },
    {
      id: "export-failures",
      label: "Export failures",
      value: summary.exportFailures,
      definition:
        "Document export jobs currently in failed status in the selected scope.",
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
