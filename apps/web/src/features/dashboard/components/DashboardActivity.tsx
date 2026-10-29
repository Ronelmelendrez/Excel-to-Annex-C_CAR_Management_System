import { Link } from "react-router-dom";
import { SectionCard } from "../../../components/ui/section-card";
import type { DashboardActivity as DashboardActivityRecord } from "../types";

export function DashboardActivity({ items }: { items: DashboardActivityRecord[] }) {
  return (
    <SectionCard
      id="dashboard-recent-activity"
      title="Recent activity"
      description="Activity categories only; no case references or staff names."
      eyebrow="Last 30 days"
    >
      {items.length === 0 ? (
        <p className="text-sm leading-6 text-[#5b574e]">
          No recent activity is available in this scope.
        </p>
      ) : (
        <ol className="divide-y divide-[#c9c3b6]">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
            >
              <Link
                to={item.destination}
                className="text-sm font-medium underline decoration-dotted underline-offset-2 hover:text-[#7a1f1f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
              >
                {item.label}
              </Link>
              <time
                dateTime={item.occurredAt}
                className="font-mono text-[10px] tabular-nums text-[#5b574e]"
              >
                {new Date(item.occurredAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
