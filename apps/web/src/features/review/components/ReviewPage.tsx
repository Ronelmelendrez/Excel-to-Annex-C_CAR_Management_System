import React from "react";
import { useAuth } from "../../../app/providers";
import { useReviewQueue } from "../hooks/useReviewQueue";
import { getCurrentReviewStatus } from "../lib/review";
import { ReviewDecisionForm } from "./ReviewDecisionForm";
import { ReviewDetail } from "./ReviewDetail";
import { ReviewFilters } from "./ReviewFilters";
import { ReviewHistory } from "./ReviewHistory";
import { ReviewQueueList } from "./ReviewQueueList";

export function ReviewPage() {
  const { profile, user, roles } = useAuth();
  const reviewerId = profile?.id ?? user?.id ?? "";
  const reviewerLabel = profile?.display_name || "Reviewer (mock)";
  const review = useReviewQueue(reviewerId, reviewerLabel);
  const canReview = roles.includes("reviewer");

  if (!canReview) {
    return (
      <div
        role="alert"
        className="max-w-[680px] border-l-4 border-[#7a1f1f] border-y border-r border-[#7a1f1f] bg-[#f2e4e1] px-4 py-4"
      >
        <h1 className="font-serif text-2xl">You do not have access to the review queue</h1>
        <p className="mt-2 text-sm leading-6 text-[#3f3b34]">
          CAR review is available to authorized reviewers. No review records are shown.
        </p>
      </div>
    );
  }

  const pendingCount = review.records.filter(
    (record) => getCurrentReviewStatus(record) === "submitted",
  ).length;

  return (
    <div>
      <header className="border-b border-[#161512] pb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e]">
          F6 / Review &amp; approval
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl leading-none tracking-tight sm:text-5xl">
              CAR review queue
            </h1>
            <p className="mt-3 max-w-[62ch] text-sm leading-6 text-[#3f3b34]">
              Check each submitted revision, review its approval gates, then record a decision with a comment.
            </p>
          </div>
          <span className="border border-[#8a5a00] bg-[#f3ead8] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#704700]">
            Mock reviews · actions reset on reload
          </span>
        </div>
      </header>

      <ReviewFilters
        search={review.search}
        status={review.statusFilter}
        total={review.records.length}
        pending={pendingCount}
        onSearchChange={review.setSearch}
        onStatusChange={review.setStatusFilter}
      />

      {review.feedback && (
        <p
          role="status"
          className="mt-4 border-l-4 border-[#2f5b3a] bg-[#e6ecdf] px-4 py-3 text-sm leading-6 text-[#244b2e]"
        >
          {review.feedback}
        </p>
      )}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(270px,0.78fr)_minmax(0,1.5fr)]">
        <ReviewQueueList
          records={review.visibleRecords}
          selectedId={review.selectedRecord?.id ?? null}
          onSelect={review.selectRecord}
        />
        <div className="min-w-0 space-y-4">
          <ReviewDetail record={review.selectedRecord} />
          {review.selectedRecord && (
            <ReviewDecisionForm
              record={review.selectedRecord}
              reviewerId={reviewerId}
              comment={review.comment}
              exceptionRequested={review.exceptionRequested}
              exceptionReason={review.exceptionReason}
              canApprove={review.canApprove}
              onCommentChange={review.setComment}
              onExceptionRequestedChange={review.setExceptionRequested}
              onExceptionReasonChange={review.setExceptionReason}
              onDecide={review.decide}
            />
          )}
        </div>
      </div>

      <div className="mt-5">
        <ReviewHistory records={review.records} />
      </div>
    </div>
  );
}
