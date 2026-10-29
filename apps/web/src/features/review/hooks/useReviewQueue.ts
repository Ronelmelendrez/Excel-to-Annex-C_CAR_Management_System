import { useMemo, useState } from "react";
import { mockReviewRecords } from "../mock-data";
import { canApproveReview, filterReviewRecords } from "../lib/review";
import type { ReviewDecision, ReviewRecord, ReviewStatusFilter } from "../types";

export function useReviewQueue(reviewerId: string, reviewerLabel: string) {
  const [records, setRecords] = useState(mockReviewRecords);
  const [selectedId, setSelectedId] = useState(mockReviewRecords[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>("submitted");
  const [comment, setComment] = useState("");
  const [exceptionRequested, setExceptionRequested] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");
  const [feedback, setFeedback] = useState("");

  const visibleRecords = useMemo(
    () => filterReviewRecords(records, search, statusFilter),
    [records, search, statusFilter],
  );
  const selectedRecord =
    visibleRecords.find((record) => record.id === selectedId) ??
    visibleRecords[0] ??
    null;

  function selectRecord(id: string) {
    setSelectedId(id);
    setComment("");
    setExceptionRequested(false);
    setExceptionReason("");
    setFeedback("");
  }

  function decide(status: ReviewDecision["status"]) {
    if (!selectedRecord || !comment.trim()) {
      setFeedback("Add a comment before recording a review decision.");
      return;
    }

    if (
      status === "approved" &&
      !canApproveReview(selectedRecord, reviewerId, exceptionRequested, exceptionReason)
    ) {
      setFeedback("Approval is blocked until every required gate passes or an eligible exception has a reason.");
      return;
    }

    if (
      status === "changes_requested" &&
      selectedRecord.submittedById === reviewerId
    ) {
      setFeedback("You cannot review a CAR you submitted.");
      return;
    }

    const at = new Date().toISOString();
    const decision: ReviewDecision = {
      status,
      comment: comment.trim(),
      actor: reviewerLabel,
      at,
      ...(status === "approved" && exceptionRequested
        ? { exceptionReason: exceptionReason.trim() }
        : {}),
    };
    setRecords((current) =>
      current.map((record) =>
        record.id === selectedRecord.id ? { ...record, decision } : record,
      ),
    );
    setStatusFilter("all");
    setFeedback(
      status === "approved"
        ? `${selectedRecord.reference} revision ${selectedRecord.revision} was approved in this mock session.`
        : `Changes were requested for ${selectedRecord.reference} revision ${selectedRecord.revision} in this mock session.`,
    );
    setComment("");
    setExceptionRequested(false);
    setExceptionReason("");
  }

  return {
    records,
    visibleRecords,
    selectedRecord,
    search,
    statusFilter,
    comment,
    exceptionRequested,
    exceptionReason,
    feedback,
    canApprove:
      selectedRecord !== null &&
      canApproveReview(selectedRecord, reviewerId, exceptionRequested, exceptionReason),
    setSearch,
    setStatusFilter,
    setComment,
    setExceptionRequested,
    setExceptionReason,
    selectRecord,
    decide,
  };
}
