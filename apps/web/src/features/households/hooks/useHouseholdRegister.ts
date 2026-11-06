import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { normalizeGrantee } from "@import-domain";
import {
  householdListCacheKey,
  householdStatsCacheKey,
  serverDataCache,
} from "../../../shared/server-data-cache";
import {
  getHouseholdRegisterStats,
  householdListError,
  listHouseholds,
  type HouseholdListResponse,
  type HouseholdRegisterStats,
} from "../api";
import { getGranteeStatus } from "../lib/households";
import type { HouseholdRecord } from "../types";
import type {
  HouseholdOverlay,
  HouseholdStatus,
  OverlayEvent,
  ReviewFilter,
} from "../types";

const HOUSEHOLD_STALE_TIME = 30_000;
const STATS_STALE_TIME = 15_000;
const HOUSEHOLD_REFRESH_INTERVAL = 30_000;

function householdSearchKey(userId: string, hhId: string) {
  return `households:${userId}:search:${hhId}`;
}

export function useHouseholdRegister(actor: string, enabled = true, userId = "") {
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

  const [households, setHouseholds] = useState<HouseholdRecord[]>(
    () => (userId ? serverDataCache.get<HouseholdListResponse>(householdListCacheKey(userId))?.data.households : undefined) ?? [],
  );
  const [searchedHouseholds, setSearchedHouseholds] = useState<HouseholdRecord[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(
    () => !userId || !serverDataCache.get<HouseholdListResponse>(householdListCacheKey(userId)),
  );
  const [dataOwnerId, setDataOwnerId] = useState(userId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [registerStats, setRegisterStats] = useState<HouseholdRegisterStats | null>(
    () => (userId ? serverDataCache.get<HouseholdRegisterStats>(householdStatsCacheKey(userId))?.data : undefined) ?? null,
  );
  const [statsError, setStatsError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const ownedHouseholds = dataOwnerId === userId ? households : [];
  const ownedSearchedHouseholds = dataOwnerId === userId ? searchedHouseholds : [];
  const ownedRegisterStats = dataOwnerId === userId ? registerStats : null;

  useLayoutEffect(() => {
    if (dataOwnerId === userId) return;
    setDataOwnerId(userId);
    setQuery("");
    setReviewFilter("all");
    setVersionFilter("all");
    setOverlays({});
    setShowResolveForm(false);
    setCandidateId("");
    setResolutionReason("");
    setExcludeMemberId(null);
    setExclusionReason("");
    setFeedback("");
    setHouseholds(
      userId
        ? serverDataCache.get<HouseholdListResponse>(householdListCacheKey(userId))?.data.households ?? []
        : [],
    );
    setSearchedHouseholds([]);
    setRegisterStats(
      userId
        ? serverDataCache.get<HouseholdRegisterStats>(householdStatsCacheKey(userId))?.data ?? null
        : null,
    );
    setSelectedId("");
    setLoading(!userId || !serverDataCache.get<HouseholdListResponse>(householdListCacheKey(userId)));
    setLoadError(null);
    setRefreshError(null);
    setSearchError(null);
    setStatsError(null);
  }, [dataOwnerId, userId]);

  useEffect(() => {
    if (!enabled) {
      setHouseholds([]);
      setRegisterStats(null);
      setLoading(false);
      return;
    }

    if (!userId) {
      setHouseholds([]);
      setRegisterStats(null);
      setLoading(false);
      setLoadError("Your signed-in user could not be identified. Sign in again to view household records.");
      return;
    }

    let cancelled = false;
    let refreshing = false;
    const key = householdListCacheKey(userId);
    const cached = serverDataCache.get<HouseholdListResponse>(key);
    setHouseholds(cached?.data.households ?? []);
    setLoading(!cached);
    setLoadError(null);
    setRefreshError(null);

    async function refreshHouseholds(force = false) {
      if (refreshing) return;
      const current = serverDataCache.get<HouseholdListResponse>(key);
      if (!force && current && serverDataCache.isFresh(current, HOUSEHOLD_STALE_TIME)) {
        setHouseholds(current.data.households);
        setLoading(false);
        return;
      }

      refreshing = true;
      if (!current) setLoading(true);
      try {
        const result = await serverDataCache.fetch(key, () => listHouseholds());
        if (cancelled) return;
        setHouseholds(result.households);
        setLoading(false);
        setLoadError(null);
        setRefreshError(null);
      } catch (error: unknown) {
        if (cancelled) return;
        setLoading(false);
        if (current) setRefreshError(householdListError(error));
        else setLoadError(householdListError(error));
      } finally {
        refreshing = false;
      }
    }

    void refreshHouseholds();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshHouseholds();
    }, HOUSEHOLD_REFRESH_INTERVAL);
    const handleResume = () => void refreshHouseholds();
    window.addEventListener("focus", handleResume);
    window.addEventListener("online", handleResume);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleResume);
      window.removeEventListener("online", handleResume);
    };
  }, [enabled, reloadToken, userId]);

  useEffect(() => {
    if (!enabled || !userId) return;
    let cancelled = false;
    let refreshing = false;
    const key = householdStatsCacheKey(userId);
    const cached = serverDataCache.get<HouseholdRegisterStats>(key);
    setRegisterStats(cached?.data ?? null);

    async function refreshStats() {
      if (refreshing) return;
      const current = serverDataCache.get<HouseholdRegisterStats>(key);
      if (current && serverDataCache.isFresh(current, STATS_STALE_TIME)) {
        setRegisterStats(current.data);
        setStatsError(null);
        return;
      }
      refreshing = true;
      try {
        const stats = await serverDataCache.fetch(key, getHouseholdRegisterStats);
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
      if (document.visibilityState === "visible") void refreshStats();
    }, STATS_STALE_TIME);
    const handleResume = () => void refreshStats();
    window.addEventListener("focus", handleResume);
    window.addEventListener("online", handleResume);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleResume);
      window.removeEventListener("online", handleResume);
    };
  }, [enabled, reloadToken, userId]);

  useEffect(() => {
    let cancelled = false;
    setSearchedHouseholds([]);
    setSearchError(null);

    const hhId = query.trim();
    const isIdLike = /^[\p{L}\p{N}_-]{4,}$/u.test(hhId);
    if (
      !enabled ||
      !userId ||
      !isIdLike ||
      ownedHouseholds.some((household) => household.hhId === hhId)
    ) {
      return () => {
        cancelled = true;
      };
    }

    const key = householdSearchKey(userId, hhId);
    const cached = serverDataCache.get<HouseholdListResponse>(key);
    if (cached) setSearchedHouseholds(cached.data.households);
    if (cached && serverDataCache.isFresh(cached, HOUSEHOLD_STALE_TIME)) {
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setTimeout(() => {
      serverDataCache.fetch(key, () => listHouseholds(hhId))
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
  }, [enabled, ownedHouseholds, query, userId]);

  const searchableHouseholds = useMemo(() => {
    const loadedIds = new Set(ownedHouseholds.map((household) => household.id));
    return [
      ...ownedHouseholds,
      ...ownedSearchedHouseholds.filter((household) => !loadedIds.has(household.id)),
    ];
  }, [ownedHouseholds, ownedSearchedHouseholds]);

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
  const needsReviewCount = ownedHouseholds.filter((household) => {
    const overlay = overlays[household.id];
    return overlay?.selectedGranteeId
      ? false
      : getGranteeStatus(household, overlay?.excludedMemberIds) !== "valid";
  }).length;
  const granteeCount = ownedHouseholds.filter((household) => {
    const overlay = overlays[household.id];
    return (
      Boolean(overlay?.selectedGranteeId) ||
      getGranteeStatus(household, overlay?.excludedMemberIds) === "valid"
    );
  }).length;
  const totalMembers = ownedHouseholds.reduce(
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
    serverDataCache.deletePrefix(`households:${userId}:`);
    setReloadToken((token) => token + 1);
  }

  return {
    households: ownedHouseholds,
    loading,
    loadError,
    refreshError,
    searchError,
    registerStats: ownedRegisterStats,
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
