import React from "react";
import { SectionCard } from "../../../components/ui/section-card";
import type { TemplateStatus, TemplateVersion } from "../types";

export function TemplateLifecycleActions({
  template,
  activeTemplate,
  issueCount,
  pendingAction,
  onRequestAction,
  onCancelAction,
  onConfirmAction,
}: {
  template: TemplateVersion;
  activeTemplate: TemplateVersion | undefined;
  issueCount: number;
  pendingAction: "approve" | "activate" | null;
  onRequestAction: (action: "approve" | "activate") => void;
  onCancelAction: () => void;
  onConfirmAction: () => void;
}) {
  const canApprove =
    template.status === "validated" && !template.approvedBy && issueCount === 0;
  const canActivate =
    template.status === "validated" && Boolean(template.approvedBy) && issueCount === 0;
  const lifecycleCopy: Record<TemplateStatus, string> = {
    draft: "Complete mappings and repeating-table configuration, then validate this draft.",
    validated: template.approvedBy
      ? `Approved by ${template.approvedBy}. This version can be activated.`
      : "Validation passed. An administrator must approve this version before activation.",
    active: "This version is active and immutable. Any changes require a new version.",
    retired: "This version is retired and immutable. Existing reports retain their original version.",
  };

  return (
    <SectionCard
      id="template-lifecycle-heading"
      eyebrow="Version lifecycle"
      title="Approval and activation"
      description={lifecycleCopy[template.status]}
    >
      {template.status === "validated" && !template.approvedBy && (
        <button
          type="button"
          onClick={() => onRequestAction("approve")}
          disabled={!canApprove}
          className="min-h-[44px] border border-[#161512] px-4 py-2 text-sm font-medium hover:bg-[#e6e0d4] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        >
          Approve version
        </button>
      )}
      {canActivate && (
        <button
          type="button"
          onClick={() => onRequestAction("activate")}
          className="min-h-[44px] border border-[#2f5b3a] bg-[#2f5b3a] px-4 py-2 text-sm font-medium text-white hover:bg-[#244b2e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
        >
          Activate version
        </button>
      )}
      {template.status === "active" && (
        <p className="border-l-4 border-[#2f5b3a] bg-[#e6ecdf] px-3 py-2 text-sm text-[#244b2e]">
          Active template · v{template.version}
        </p>
      )}
      {template.status === "retired" && (
        <p className="border-l-4 border-[#8c877c] bg-[#ece7dc] px-3 py-2 text-sm text-[#5b574e]">
          Retired version · v{template.version}
        </p>
      )}
      {template.approvedAt && (
        <p className="mt-3 text-xs leading-5 text-[#5b574e]">
          Approved {new Date(template.approvedAt).toLocaleString()}
          {template.activatedAt && ` · Activated ${new Date(template.activatedAt).toLocaleString()}`}
        </p>
      )}
      {pendingAction && (
        <div
          role="alert"
          className="mt-4 border-l-4 border-[#8a5a00] bg-[#f3ead8] p-4 text-[#704700]"
        >
          <p className="text-sm font-semibold">
            {pendingAction === "activate"
              ? `Activate ${template.name} v${template.version}?`
              : `Approve ${template.name} v${template.version}?`}
          </p>
          <p className="mt-1 text-xs leading-5">
            {pendingAction === "activate"
              ? `Activation retires ${activeTemplate?.name ?? "the current"} v${activeTemplate?.version ?? "active"} and this version becomes immutable.`
              : "Approval is a mock administrator action. No production authorization or audit record is created."}
            {" "}This action only changes local demo state.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onConfirmAction}
              className="min-h-[40px] border border-[#704700] bg-[#704700] px-3 py-2 text-xs font-semibold text-white hover:bg-[#593900] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
            >
              Confirm {pendingAction === "activate" ? "activation" : "approval"}
            </button>
            <button
              type="button"
              onClick={onCancelAction}
              className="min-h-[40px] border border-[#704700] px-3 py-2 text-xs font-semibold hover:bg-[#ead9b9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
