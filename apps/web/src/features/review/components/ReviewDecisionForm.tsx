import React from "react";
import { Label } from "../../../components/ui/label";
import { SectionCard } from "../../../components/ui/section-card";
import type { ReviewRecord } from "../types";

export function ReviewDecisionForm({
  record,
  reviewerId,
  comment,
  exceptionRequested,
  exceptionReason,
  canApprove,
  onCommentChange,
  onExceptionRequestedChange,
  onExceptionReasonChange,
  onDecide,
}: {
  record: ReviewRecord;
  reviewerId: string;
  comment: string;
  exceptionRequested: boolean;
  exceptionReason: string;
  canApprove: boolean;
  onCommentChange: (value: string) => void;
  onExceptionRequestedChange: (value: boolean) => void;
  onExceptionReasonChange: (value: string) => void;
  onDecide: (decision: "approved" | "changes_requested") => void;
}) {
  const isSubmitted = record.status === "submitted" && !record.decision;
  const isOwnSubmission = record.submittedById === reviewerId;
  const exceptionGate = record.gates.find((gate) => !gate.passed && gate.exceptionEligible);
  const blockingGate = record.gates.find((gate) => !gate.passed && !gate.exceptionEligible);

  if (!isSubmitted) {
    return (
      <SectionCard id="review-decision-heading" title="Review decision">
        <p className="text-sm leading-6 text-[#5b574e]">
          This revision is read-only. An approved CAR cannot be changed; edits require a new revision.
        </p>
      </SectionCard>
    );
  }

  if (isOwnSubmission) {
    return (
      <SectionCard id="review-decision-heading" title="Review decision">
        <p role="alert" className="text-sm leading-6 text-[#7a1f1f]">
          You submitted this CAR and cannot approve or return it. No report details are changed.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      id="review-decision-heading"
      title="Record a decision"
      description="A comment is required for every decision. These controls update mock session state only."
    >
      <Label htmlFor="review-comment" className="block text-sm font-semibold">
        Reviewer comment
      </Label>
      <textarea
        id="review-comment"
        value={comment}
        onChange={(event) => onCommentChange(event.target.value)}
        rows={4}
        required
        aria-describedby="review-comment-help"
        className="mt-1 min-h-28 w-full border border-[#8c877c] bg-[#fbf9f4] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
      />
      <p id="review-comment-help" className="mt-1 text-xs text-[#5b574e]">
        Explain the basis for approval or the changes needed.
      </p>

      {exceptionGate && !blockingGate && (
        <div className="mt-4 border-l-4 border-[#8a5a00] bg-[#f3ead8] p-3">
          <Label className="flex items-start gap-2 text-sm font-semibold text-[#704700]">
            <input
              type="checkbox"
              checked={exceptionRequested}
              onChange={(event) => onExceptionRequestedChange(event.target.checked)}
              className="mt-1 h-4 w-4 accent-[#704700] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
            />
            Request a mock exception for {exceptionGate.label.toLocaleLowerCase()}
          </Label>
          <p className="mt-1 pl-6 text-xs leading-5 text-[#704700]">
            Exception policy is not connected. Do not treat this sample action as authorization.
          </p>
          {exceptionRequested && (
            <div className="mt-3 pl-6">
              <Label htmlFor="review-exception-reason" className="block text-xs font-semibold">
                Exception reason
              </Label>
              <textarea
                id="review-exception-reason"
                value={exceptionReason}
                onChange={(event) => onExceptionReasonChange(event.target.value)}
                rows={3}
                required
                className="mt-1 min-h-20 w-full border border-[#8c877c] bg-[#fbf9f4] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
              />
            </div>
          )}
        </div>
      )}

      {blockingGate && (
        <p role="status" className="mt-4 border-l-4 border-[#7a1f1f] bg-[#f2e4e1] px-3 py-2 text-sm leading-5 text-[#7a1f1f]">
          Approval is blocked by {blockingGate.label}. This gate cannot be overridden.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onDecide("approved")}
          disabled={!canApprove || !comment.trim()}
          title={!canApprove ? "Pass all blocking gates and provide any required exception reason." : undefined}
          className="min-h-[44px] border border-[#2f5b3a] bg-[#2f5b3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#244b2e] disabled:cursor-not-allowed disabled:border-[#b5afa2] disabled:bg-[#b5afa2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
        >
          Approve revision {record.revision}
        </button>
        <button
          type="button"
          onClick={() => onDecide("changes_requested")}
          disabled={!comment.trim()}
          className="min-h-[44px] border border-[#161512] px-4 py-2 text-sm font-semibold hover:bg-[#e6e0d4] disabled:cursor-not-allowed disabled:border-[#b5afa2] disabled:text-[#8c877c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
        >
          Request changes
        </button>
      </div>
    </SectionCard>
  );
}
