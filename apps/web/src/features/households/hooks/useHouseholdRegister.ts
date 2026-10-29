import { useMemo, useState } from "react";
import { normalizeGrantee } from "@import-domain";
import { mockHouseholds } from "../mock-data";
import type {
  HouseholdOverlay,
  HouseholdStatus,
  OverlayEvent,
  ReviewFilter,
} from "../types";
import { getGranteeStatus } from "../lib/households";

export function useHouseholdRegister(actor: string) {
  const [query, setQuery] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [versionFilter, setVersionFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(mockHouseholds[0]?.id ?? "");
  const [overlays, setOverlays] = useState<Record<string, HouseholdOverlay>>({});
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [candidateId, setCandidateId] = useState("");
  const [resolutionReason, setResolutionReason] = useState("");
  const [excludeMemberId, setExcludeMemberId] = useState<string | null>(null);
  const [exclusionReason, setExclusionReason] = useState("");
  const [feedback, setFeedback] = useState("");

  const visibleHouseholds = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return mockHouseholds.flatMap((household) => {
      const overlay = overlays[household.id];
      const status: HouseholdStatus = overlay?.selectedGranteeId
        ? "resolved"
        : getGranteeStatus(household, overlay?.excludedMemberIds);
      const matchesSearch =
        !needle ||
        household.hhId.toLocaleLowerCase().includes(needle) ||
        household.barangay.toLocaleLowerCase().includes(needle) ||
        household.members.some((member) => member.name.toLocaleLowerCase().includes(needle));
      const matchesStatus =
        reviewFilter === "all" ||
        (reviewFilter === "needs_review" && status !== "valid" && status !== "resolved") ||
        (reviewFilter === "ok" && status === "valid") ||
        (reviewFilter === "resolved" && status === "resolved");
      const matchesVersion = versionFilter === "all" || household.importVersion === Number(versionFilter);

      return matchesSearch && matchesStatus && matchesVersion ? [{ household, status }] : [];
    });
  }, [overlays, query, reviewFilter, versionFilter]);

  const selected =
    visibleHouseholds.find(({ household }) => household.id === selectedId)?.household ??
    visibleHouseholds[0]?.household ??
    null;
  const selectedOverlay = selected ? overlays[selected.id] : undefined;
  const selectedStatus = selected
    ? selectedOverlay?.selectedGranteeId
      ? "resolved"
      : getGranteeStatus(selected, selectedOverlay?.excludedMemberIds)
    : null;
  const activeGrantee = selectedOverlay?.selectedGranteeId
    ? selected?.members.find((member) => member.id === selectedOverlay.selectedGranteeId)
    : selected?.members.find((member) => normalizeGrantee(member.granteeFlag) === true);
  const needsReviewCount = mockHouseholds.filter((household) => {
    const overlay = overlays[household.id];
    return overlay?.selectedGranteeId
      ? false
      : getGranteeStatus(household, overlay?.excludedMemberIds) !== "valid";
  }).length;
  const granteeCount = mockHouseholds.filter((household) => {
    const overlay = overlays[household.id];
    return (
      Boolean(overlay?.selectedGranteeId) ||
      getGranteeStatus(household, overlay?.excludedMemberIds) === "valid"
    );
  }).length;
  const totalMembers = mockHouseholds.reduce((total, household) => total + household.members.length, 0);

  function recordOverlay(householdId: string, event: OverlayEvent, update: Partial<HouseholdOverlay>) {
    setOverlays((current) => {
      const existing = current[householdId] ?? { excludedMemberIds: [], events: [] };
      return {
        ...current,
        [householdId]: {
          ...existing,
          ...update,
          events: [...existing.events, event],
        },
      };
    });
  }

  function saveResolution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !candidateId || !resolutionReason.trim()) return;
    const member = selected.members.find((item) => item.id === candidateId);
    if (!member || selectedOverlay?.excludedMemberIds.includes(member.id)) return;

    recordOverlay(
      selected.id,
      {
        action: "Grantee corrected",
        actor,
        reason: resolutionReason.trim(),
        memberName: member.name,
        beforeValue:
          selected.members
            .filter((item) => normalizeGrantee(item.granteeFlag) === true)
            .map((item) => `${item.name}: Yes`)
            .join(", ") || "No validated Yes flag",
        afterValue: `${member.name}: selected as the corrected grantee`,
        at: new Date().toISOString(),
      },
      { selectedGranteeId: member.id },
    );
    setShowResolveForm(false);
    setCandidateId("");
    setResolutionReason("");
    setFeedback(`Local correction recorded for ${selected.hhId}. Imported GRANTEE values remain unchanged.`);
  }

  function saveExclusion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !excludeMemberId || !exclusionReason.trim()) return;
    const member = selected.members.find((item) => item.id === excludeMemberId);
    if (!member || selectedOverlay?.excludedMemberIds.includes(member.id)) return;
    const excludedMemberIds = [...new Set([...(selectedOverlay?.excludedMemberIds ?? []), member.id])];

    recordOverlay(
      selected.id,
      {
        action: "Member excluded",
        actor,
        reason: exclusionReason.trim(),
        memberName: member.name,
        beforeValue: "Included in household",
        afterValue: "Excluded by local overlay",
        at: new Date().toISOString(),
      },
      {
        excludedMemberIds,
        ...(selectedOverlay?.selectedGranteeId === member.id ? { selectedGranteeId: undefined } : {}),
      },
    );
    setExcludeMemberId(null);
    setExclusionReason("");
    setFeedback(`Local exclusion recorded for ${member.name}. The source row remains in the import.`);
  }

  function restoreMember(memberId: string) {
    if (!selected) return;
    const member = selected.members.find((item) => item.id === memberId);
    if (!member) return;
    const excludedMemberIds = (selectedOverlay?.excludedMemberIds ?? []).filter((id) => id !== memberId);

    recordOverlay(
      selected.id,
      {
        action: "Member restored",
        actor,
        reason: "Restored in this mock session.",
        memberName: member.name,
        beforeValue: "Excluded by local overlay",
        afterValue: "Included in household",
        at: new Date().toISOString(),
      },
      { excludedMemberIds },
    );
    setFeedback(`${member.name} was restored in this mock session.`);
  }

  function selectHousehold(id: string) {
    setSelectedId(id);
    setShowResolveForm(false);
    setCandidateId("");
    setResolutionReason("");
    setExcludeMemberId(null);
    setExclusionReason("");
    setFeedback("");
  }

  function toggleResolveForm() {
    setShowResolveForm((open) => !open);
    setCandidateId("");
    setResolutionReason("");
    setExcludeMemberId(null);
    setExclusionReason("");
  }

  function startExclusion(memberId: string) {
    setExcludeMemberId(memberId);
    setExclusionReason("");
    setShowResolveForm(false);
    setCandidateId("");
    setResolutionReason("");
  }

  function cancelExclusion() {
    setExcludeMemberId(null);
    setExclusionReason("");
  }

  return {
    query,
    setQuery,
    reviewFilter,
    setReviewFilter,
    versionFilter,
    setVersionFilter,
    visibleHouseholds,
    selected,
    selectedOverlay,
    selectedStatus,
    activeGrantee,
    needsReviewCount,
    granteeCount,
    totalMembers,
    feedback,
    showResolveForm,
    candidateId,
    setCandidateId,
    resolutionReason,
    setResolutionReason,
    excludeMemberId,
    exclusionReason,
    setExclusionReason,
    selectHousehold,
    toggleResolveForm,
    saveResolution,
    startExclusion,
    saveExclusion,
    cancelExclusion,
    restoreMember,
  };
}
