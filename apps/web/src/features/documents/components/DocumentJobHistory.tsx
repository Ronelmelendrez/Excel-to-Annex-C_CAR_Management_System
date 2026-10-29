import React from "react";
import { SectionCard } from "../../../components/ui/section-card";
import type { GeneratedDocumentRecord } from "../types";

export function DocumentJobHistory({ record }: { record: GeneratedDocumentRecord }) {
  const jobs = record.jobs
    .slice()
    .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));

  return (
    <SectionCard
      id="document-history-heading"
      eyebrow="Export activity"
      title="Job history"
      description="Mock records only. Production export logging and audit persistence are not connected."
      contentClassName="pt-0"
    >
      {jobs.length === 0 ? (
        <p className="text-sm leading-6 text-[#5b574e]">
          No export jobs for this revision. Generate an output after confirming the CAR is approved.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#ece7dc]">
                {["Report / revision", "Format", "Requester", "Requested", "Status", "Attempt"].map(
                  (heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="border-b border-[#c9c3b6] px-3 py-2 font-mono text-[10px] uppercase"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="odd:bg-[#fbf9f4]">
                  <th scope="row" className="border-b border-[#e2ddd1] px-3 py-2 font-mono text-xs font-medium">
                    {record.reference} · r{record.revision}
                  </th>
                  <td className="border-b border-[#e2ddd1] px-3 py-2 uppercase">{job.format}</td>
                  <td className="border-b border-[#e2ddd1] px-3 py-2">{job.requestedBy}</td>
                  <td className="border-b border-[#e2ddd1] px-3 py-2 text-xs">
                    {new Date(job.requestedAt).toLocaleString()}
                  </td>
                  <td className="border-b border-[#e2ddd1] px-3 py-2">{job.status}</td>
                  <td className="border-b border-[#e2ddd1] px-3 py-2 tabular-nums">{job.attempt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
