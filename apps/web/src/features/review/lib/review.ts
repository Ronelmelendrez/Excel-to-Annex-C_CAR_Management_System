import type { ReviewRecord } from "../types";

export function getCurrentReviewStatus(record: ReviewRecord): ReviewRecord["status"] {
  return record.decision?.status ?? record.status;
}

export function canApproveReview(
  record: ReviewRecord,
  reviewerId: string,
  exceptionRequested: boolean,
  exceptionReason: string,
): boolean {
  if (getCurrentReviewStatus(record) !== "submitted" || record.submittedById === reviewerId) {
    return false;
  }

  const failedGates = record.gates.filter((gate) => !gate.passed);
  if (failedGates.length === 0) return true;

  return (
    exceptionRequested &&
    exceptionReason.trim().length > 0 &&
    failedGates.every((gate) => gate.exceptionEligible)
  );
}

export function filterReviewRecords(
  records: ReviewRecord[],
  search: string,
  status: "all" | ReviewRecord["status"],
): ReviewRecord[] {
  const query = search.trim().toLocaleLowerCase();
  return records.filter((record) => {
    const matchesStatus = status === "all" || getCurrentReviewStatus(record) === status;
    const matchesSearch =
      query.length === 0 ||
      record.reference.toLocaleLowerCase().includes(query) ||
      record.householdLabel.toLocaleLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });
}
