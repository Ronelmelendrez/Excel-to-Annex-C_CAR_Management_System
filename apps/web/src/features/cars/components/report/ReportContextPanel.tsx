import React, { useState } from "react";
import { REPORT_TEMPLATE_VERSION } from "@report-template";
import type { CarChecklistItem, CarDraft, CarTemplateOption } from "../../types";

/**
 * Right-hand context panel (plan §5): Missing (the approval checklist with
 * jump links), Data source (template version, import, grantee provenance),
 * and History (revision log).
 */
export function ReportContextPanel({
  draft,
  checklist,
  missingCount,
  templateVersions,
  history,
  onJumpToField,
  onUpdateDraft,
}: {
  draft: CarDraft;
  checklist: CarChecklistItem[];
  missingCount: number;
  templateVersions: CarTemplateOption[];
  history: CarDraft["history"];
  onJumpToField: (fieldId: string) => void;
  onUpdateDraft: (update: Partial<CarDraft>) => void;
}) {
  const [tab, setTab] = useState<"missing" | "source" | "history">("missing");

  const tabs = [
    { id: "missing" as const, label: `Missing (${missingCount})` },
    { id: "source" as const, label: "Data source" },
    { id: "history" as const, label: "History" },
  ];

  return (
    <aside className="min-w-0 space-y-3 xl:sticky xl:top-4">
      <div className="border border-[#c9c3b6] bg-[#fbf9f4]">
        <div className="flex border-b border-[#c9c3b6]" role="tablist" aria-label="Report context">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => setTab(entry.id)}
              className={`min-h-[40px] flex-1 border-r border-[#e2ddd1] px-2 text-xs font-semibold last:border-r-0 ${
                tab === entry.id
                  ? "bg-[#161512] text-[#f4f1ea]"
                  : "text-[#5b574e] hover:bg-[#ece7dc]"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="px-3 py-3">
          {tab === "missing" ? (
            missingCount === 0 ? (
              <p className="text-sm leading-6 text-[#161512]">
                Every required field is filled. This draft is still not approved until a reviewer
                approves it.
              </p>
            ) : (
              <>
                <p className="mb-2 text-xs leading-5 text-[#704700]">
                  Approval is blocked while required blanks remain. Fill each one, or record an
                  authorized exception during review.
                </p>
                <ul className="divide-y divide-[#e2ddd1]">
                  {checklist.map((item) => (
                    <li key={item.id} className="py-1.5">
                      {item.complete ? (
                        <span className="flex items-start gap-2 text-sm text-[#161512]">
                          <span aria-hidden="true" className="text-[#7a1f1f]">
                            ✓
                          </span>
                          <span>{item.label}</span>
                          <span className="sr-only">Complete</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onJumpToField(item.id)}
                          className="flex min-h-[30px] items-start gap-2 text-left text-sm text-[#704700] underline decoration-1 underline-offset-2 hover:text-[#8a5a00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
                        >
                          <span aria-hidden="true">!</span>
                          <span>{item.label}</span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : null}

          {tab === "source" ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-[#5b574e]">Template version</dt>
                <dd className="mt-1">
                  <select
                    aria-label="Template version"
                    value={draft.templateVersion}
                    onChange={(event) => onUpdateDraft({ templateVersion: event.target.value })}
                    className="min-h-[38px] w-full border border-[#c9c3b6] bg-white px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
                  >
                    <option value={REPORT_TEMPLATE_VERSION}>
                      Annex C · {REPORT_TEMPLATE_VERSION} (built in)
                    </option>
                    {templateVersions.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.label}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#5b574e]">CAR reference</dt>
                <dd className="font-mono text-sm">{draft.reference}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#5b574e]">Import</dt>
                <dd className="break-words text-sm">
                  {draft.importName} · version {draft.importVersion}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#5b574e]">Household</dt>
                <dd className="font-mono text-sm">HH_ID {draft.hhId}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#5b574e]">Grantee source row</dt>
                <dd className="text-sm">
                  {draft.granteeName} · import row {draft.granteeSourceRow}
                </dd>
              </div>
              <p className="border-l-4 border-[#161512] bg-[#ece7dc] px-2 py-1.5 text-xs leading-5 text-[#3f3b34]">
                Imported blanks are filled automatically from these rows. Overrides keep the
                original value and a reason; the imported rows themselves are never edited.
              </p>
            </dl>
          ) : null}

          {tab === "history" ? (
            <ol className="space-y-3">
              {history.length === 0 ? (
                <li className="text-sm text-[#5b574e]">No draft history entries yet.</li>
              ) : (
                history.map((entry) => (
                  <li key={entry.id} className="border-l-2 border-[#c9c3b6] pl-3">
                    <p className="text-sm font-medium">{entry.label}</p>
                    <time dateTime={entry.at} className="mt-1 block font-mono text-[10px] text-[#5b574e]">
                      {new Date(entry.at).toLocaleString()}
                    </time>
                  </li>
                ))
              )}
            </ol>
          ) : null}
        </div>
      </div>

      <p className="border border-[#e2ddd1] bg-[#fbf9f4] px-3 py-2 text-xs leading-5 text-[#5b574e]">
        Revision {draft.revision} · autosaved to Supabase. Approval, submission and document
        generation run in the review workflow, not on this page.
      </p>
    </aside>
  );
}
