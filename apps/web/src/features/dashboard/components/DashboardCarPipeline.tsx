import { SectionCard } from "../../../components/ui/section-card";
import { DashboardMetric } from "./DashboardMetric";
import type { DashboardSummary } from "../types";

const pipelineLabels: Array<{
  status: keyof DashboardSummary["carPipeline"];
  label: string;
}> = [
  { status: "draft", label: "Draft" },
  { status: "submitted", label: "Awaiting review" },
  { status: "changes_requested", label: "Changes requested" },
  { status: "approved", label: "Approved" },
];

export function DashboardCarPipeline({ summary }: { summary: DashboardSummary }) {
  return (
    <SectionCard
      id="dashboard-car-pipeline"
      title="CAR pipeline"
      description="Current status of each CAR in the selected area"
      eyebrow="Case assessments"
      delay={360}
    >
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
        {pipelineLabels.map(({ status, label }) => (
          <DashboardMetric
            key={status}
            variant="row"
            metric={{
              id: `car-${status}`,
              label,
              value: summary.carPipeline[status],
              definition: `Number of CARs currently marked ${label.toLowerCase()} in the selected area.`,
            }}
          />
        ))}
      </div>
    </SectionCard>
  );
}
