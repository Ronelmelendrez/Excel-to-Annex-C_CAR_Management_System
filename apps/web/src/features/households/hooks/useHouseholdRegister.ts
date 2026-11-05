import { useEffect, useMemo, useState } from "react";
import { normalizeGrantee } from "@import-domain";
import {
  getHouseholdRegisterStats,
  householdListError,
  listHouseholds,
  type HouseholdRegisterStats,
} from "../api";
import { isDemoMode } from "../../../shared/supabase";
import { mockHouseholds } from "../mock-data";
import type { HouseholdRecord } from "../mock-data";
import type {
  HouseholdOverlay,
  HouseholdStatus,
  OverlayEvent,
  ReviewFilter,
} from "../types";
import { getGranteeStatus } from "../lib/households";

export function useHouseholdRegister(actor: string, enabled = true) {
  const [query, setQuery] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [versionFilter, setVersionFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [overlays, setOverlays] = useState<Record<string, HouseholdOverlay>>({});
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [candidateId, setCandidateId] = useState("");
  const [resolutionReason, setResolutionReason] = useState("");
  const [excludeMemberId, setExcludeMemberId] = useState<string | null>(null);
  const [exclusionReason, setExclusionReason] = useState("");
  const [feedback, setFeedback] = useState("");

  // Demo mode seeds the sample synchronously so the first render is complete;
  // real mode starts empty and loads from Supabase below.
  const [households, setHouseholds] = useState<HouseholdRecord[]>(() =>
    isDemoMode ? mockHouseholds : [],
  );
  const [searchedHouseholds, setSearchedHouseholds] = useState<HouseholdRecord[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isDemoMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [registerStats, setRegisterStats] = useState<HouseholdRegisterStats | null>(() => {
    if (!isDemoMode) return null;
    const householdCount = mockHouseholds.length;
    const granteeCount = mockHouseholds.filter(
      (household) => getGranteeStatus(household) === "valid",
    ).length;
    return {
      householdCount,
      memberCount: mockHouseholds.reduce(
        (total, household) => total + household.members.length,
        0,
      ),
      granteeCount,
      needsReviewCount: householdCount - granteeCount,
    };
  });
  const [statsError, setStatsError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (isDemoMode || !enabled) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listHouseholds()
      .then((result) => {
        if (cancelled) return;
        setHouseholds(result.households);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(householdListError(error));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, reloadToken]);

  useEffect(() => {
    if (isDemoMode || !enabled) return;
    let cancelled = false;
    let refreshing = false;

    async function refreshStats() {
      if (refreshing) return;
      refreshing = true;
      try {
        const stats = await getHouseholdRegisterStats();
        if (!cancelled) {
          setRegisterStats(stats);
          setStatsError(null);
        }
      } catch (error: unknown) {
        if (!cancelled) setStatsError(householdListError(error));
      } finally {
        refreshing = false;
      }
    }

    void refreshStats();
    const interval = window.setInterval(() => {
      void refreshStats();
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [enabled, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    setSearchedHouseholds([]);
    setSearchError(null);

    const hhId = query.trim();
    const isIdLike = /^[\p{L}\p{N}_-]{4,}$/u.test(hhId);
    if (
      isDemoMode ||
      !enabled ||
      !isIdLike ||
      households.some((household) => household.hhId === hhId)
    ) {
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setTimeout(() => {
      listHouseholds(hhId)
        .then((result) => {
          if (!cancelled) setSearchedHouseholds(result.households);
        })
        .catch((error: unknown) => {
          if (!cancelled) setSearchError(householdListError(error));
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, households, query]);

  const searchableHouseholds = useMemo(() => {
    const loadedIds = new Set(households.map((household) => household.id));
    return [
      ...households,
      ...searchedHouseholds.filter((household) => !loadedIds.has(household.id)),
    ];
  }, [households, searchedHouseholds]);

  const versionOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const household of searchableHouseholds) {
      const value = `${household.importName}::${household.importVersion}`;
      if (options.has(value)) continue;
      const file = household.importName.replace(/\.(xlsx|xlsm|xls|csv)$/i, "");
      options.set(value, `${file} · v${household.importVersion}`);
    }
    return [...options.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [searchableHouseholds]);

  const visibleHouseholds = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return searchableHouseholds.flatMap((household) => {
      const overlay = overlays[household.id];
      const matchesHouseholdId = household.hhId.toLocaleLowerCase() === needle;
      const status: HouseholdStatus = overlay?.selectedGranteeId
        ? "resolved"
        : getGranteeStatus(household, overlay?.excludedMemberIds);
      const matchesSearch =
        !needle ||
        household.hhId.toLocaleLowerCase().includes(needle) ||
        household.barangay.toLocaleLowerCase().includes(needle) ||
        household.members.some((member) => member.name.toLocaleLowerCase().includes(needle));
      const matchesStatus =
        matchesHouseholdId ||
        reviewFilter === "all" ||
        (reviewFilter === "needs_review" && status !== "valid" && status !== "resolved") ||
        (reviewFilter === "ok" && status === "valid") ||
        (reviewFilter === "resolved" && status === "resolved");
      const matchesVersion =
        matchesHouseholdId ||
        versionFilter === "all" ||
        `${household.importName}::${household.importVersion}` === versionFilter;

      return matchesSearch && matchesStatus && matchesVersion ? [{ household, status }] : [];
    });
  }, [searchableHouseholds, overlays, query, reviewFilter, versionFilter]);

  const selected =
    visibleHouseholds.find(({ household }) => household.id === selectedId)?.household ??
    visibleHouseholds[0]?.household ??
    null;
  const selectedOverlay = selected ? overlays[selected.id] : undefined;
  const selectedStatus: HouseholdStatus | null = selected
    ? selectedOverlay?.selectedGranteeId
      ? "resolved"
      : getGranteeStatus(selected, selectedOverlay?.excludedMemberIds)
    : null;
  const activeGrantee = selectedOverlay?.selectedGranteeId
    ? selected?.members.find((member) => member.id === selectedOverlay.selectedGranteeId)
    : selected?.members.find((member) => normalizeGrantee(member.granteeFlag) === true);
  const needsReviewCount = households.filter((household) => {
    const overlay = overlays[household.id];
    return overlay?.selectedGranteeId
      ? false
      : getGranteeStatus(household, overlay?.excludedMemberIds) !== "valid";
  }).length;
  const granteeCount = households.filter((household) => {
    const overlay = overlays[household.id];
    return (
      Boolean(overlay?.selectedGranteeId) ||
      getGranteeStatus(household, overlay?.excludedMemberIds) === "valid"
    );
  }).length;
  const totalMembers = households.reduce(
    (total, household) => total + household.members.length,
    0,
  );

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
        reason: "Restored in this session.",
        memberName: member.name,
        beforeValue: "Excluded by local overlay",
        afterValue: "Included in household",
        at: new Date().toISOString(),
      },
      { excludedMemberIds },
    );
    setFeedback(`${member.name} was restored.`);
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

  function reload() {
    setReloadToken((token) => token + 1);
  }

  return {
    households,
    loading,
    loadError,
    searchError,
    registerStats,
    statsError,
    reload,
    versionOptions,
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
