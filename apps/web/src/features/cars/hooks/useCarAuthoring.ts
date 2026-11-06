import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { normalizeGrantee } from "@import-domain";
import { householdListError, listHouseholds } from "../../households/api";
import { getGranteeStatus } from "../../households/lib/households";
import type { HouseholdRecord } from "../../households/types";
import { isSupabaseConfigured } from "../../../shared/supabase";
import {
  carDraftsCacheKey,
  carTemplatesCacheKey,
  householdListCacheKey,
  serverDataCache,
} from "../../../shared/server-data-cache";
import {
  carErrorMessage,
  createCar,
  createCarRevision,
  deleteCar,
  listCarTemplates,
  listCars,
  updateCar,
} from "../api";
import { appendHistoryEntry, getCarChecklist, getDraftStatus } from "../lib/car-draft";
import { customIntervention, resolveSlotValues, withSlotValue } from "../lib/report/values";
import { SLOT_BY_KEY } from "@report-template";
import type {
  CarDraft,
  CarSaveState,
  CarTemplateOption,
  ReportMode,
  ValidatedHousehold,
} from "../types";

/** How long a burst of edits waits before it is written to Supabase. */
const AUTOSAVE_DELAY_MS = 700;
const CAR_DATA_STALE_TIME = 30_000;
const HOUSEHOLD_DATA_STALE_TIME = 30_000;

const LOAD_ERROR_FALLBACK =
  "CAR drafts could not be loaded. Check your internet connection and try again.";
const SAVE_ERROR_FALLBACK =
  "Your changes could not be saved. Check your internet connection and try again.";

/** Households the register marks as a valid CAR source (exactly one grantee). */
function deriveValidatedHouseholds(households: HouseholdRecord[]): ValidatedHousehold[] {
  return households.flatMap((household) => {
    if (getGranteeStatus(household) !== "valid") return [];
    const grantee = household.members.find((member) => normalizeGrantee(member.granteeFlag) === true);
    return grantee ? [{ ...household, grantee }] : [];
  });
}

/**
 * Fallback used when the household register cannot be reloaded: the CAR keeps
 * its own snapshot of the source identifiers in `content`.
 */
function householdFromDraft(draft: CarDraft): ValidatedHousehold {
  return {
    id: draft.householdId,
    hhId: draft.hhId,
    barangay: "",
    municipality: "",
    importName: draft.importName,
    importVersion: draft.importVersion,
    members: [],
    car: null,
    grantee: {
      id: draft.granteeMemberId,
      entryId: "",
      name: draft.granteeName,
      relationship: "",
      age: null,
      granteeFlag: "Yes",
      sourceRow: draft.granteeSourceRow,
    },
  };
}

export function useCarAuthoring(enabled = true, userId = "") {
  const [drafts, setDrafts] = useState<CarDraft[]>(
    () => (userId ? serverDataCache.get<CarDraft[]>(carDraftsCacheKey(userId))?.data : undefined) ?? [],
  );
  const [dataOwnerId, setDataOwnerId] = useState(userId);
  const [loading, setLoading] = useState(
    () => isSupabaseConfigured && enabled && !(userId && serverDataCache.get<CarDraft[]>(carDraftsCacheKey(userId))),
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [households, setHouseholds] = useState<ValidatedHousehold[]>(() => {
    if (!userId) return [];
    const cached = serverDataCache.get<Awaited<ReturnType<typeof listHouseholds>>>(
      householdListCacheKey(userId),
    );
    return cached ? deriveValidatedHouseholds(cached.data.households) : [];
  });
  const [householdsLoading, setHouseholdsLoading] = useState(() => {
    if (!isSupabaseConfigured || !enabled || !userId) return false;
    return !serverDataCache.get(householdListCacheKey(userId));
  });
  const [householdsError, setHouseholdsError] = useState<string | null>(null);
  const [householdsRefreshError, setHouseholdsRefreshError] = useState<string | null>(null);
  const [templateVersions, setTemplateVersions] = useState<CarTemplateOption[]>(
    () => (userId ? serverDataCache.get<CarTemplateOption[]>(carTemplatesCacheKey(userId))?.data : undefined) ?? [],
  );

  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(
    () => (userId ? serverDataCache.get<CarDraft[]>(carDraftsCacheKey(userId))?.data[0]?.id : null) ?? null,
  );
  const [saveState, setSaveState] = useState<CarSaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Failures from the create-draft form (shown in the left panel). */
  const [createError, setCreateError] = useState<string | null>(null);
  /** Failures from delete / new-revision actions (shown in the editor). */
  const [actionError, setActionError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creatingRevision, setCreatingRevision] = useState(false);
  const [mode, setModeState] = useState<ReportMode>("edit");

  const mountedRef = useRef(true);
  const saveTimerRef = useRef<number | null>(null);
  const pendingRef = useRef<CarDraft | null>(null);
  const saveSeqRef = useRef(0);

  const cacheOwner = dataOwnerId === userId ? userId : "";
  const ownerMatches = dataOwnerId === userId;
  const ownedDrafts = ownerMatches ? drafts : [];
  const ownedHouseholds = ownerMatches ? households : [];
  const selectedDraft = ownedDrafts.find((draft) => draft.id === selectedDraftId) ?? null;

  useLayoutEffect(() => {
    if (dataOwnerId === userId) return;
    setDataOwnerId(userId);
    setDrafts(userId ? serverDataCache.get<CarDraft[]>(carDraftsCacheKey(userId))?.data ?? [] : []);
    setSelectedDraftId(
      userId ? serverDataCache.get<CarDraft[]>(carDraftsCacheKey(userId))?.data[0]?.id ?? null : null,
    );
    setLoading(
      Boolean(
        isSupabaseConfigured &&
          enabled &&
          (!userId || !serverDataCache.get<CarDraft[]>(carDraftsCacheKey(userId))),
      ),
    );
    setLoadError(null);
    setRefreshError(null);
    const householdCache = userId
      ? serverDataCache.get<Awaited<ReturnType<typeof listHouseholds>>>(householdListCacheKey(userId))
      : undefined;
    setHouseholds(householdCache ? deriveValidatedHouseholds(householdCache.data.households) : []);
    setHouseholdsLoading(Boolean(isSupabaseConfigured && enabled && userId && !householdCache));
    setHouseholdsError(null);
    setHouseholdsRefreshError(null);
    setTemplateVersions(userId ? serverDataCache.get<CarTemplateOption[]>(carTemplatesCacheKey(userId))?.data ?? [] : []);
  }, [dataOwnerId, enabled, userId]);

  const updateDrafts = useCallback(
    (update: (current: CarDraft[]) => CarDraft[]) => {
      setDrafts((current) => {
        const next = update(current);
        if (cacheOwner) serverDataCache.set(carDraftsCacheKey(cacheOwner), next);
        return next;
      });
    },
    [cacheOwner],
  );

  const household = useMemo(() => {
    if (!selectedDraft) return null;
    const match = households.find((record) => record.id === selectedDraft.householdId);
    return match ?? householdFromDraft(selectedDraft);
  }, [households, selectedDraft]);

  const checklist = useMemo(
    () => (selectedDraft ? getCarChecklist(selectedDraft, household) : []),
    [selectedDraft, household],
  );
  const missingItems = checklist.filter((item) => !item.complete);

  /** Writes the pending draft to Supabase; safe to call at any time. */
  const flushSave = useCallback(async (): Promise<void> => {
    const draft = pendingRef.current;
    if (!draft) return;
    pendingRef.current = null;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const sequence = ++saveSeqRef.current;
    const payload: CarDraft = {
      ...draft,
      history: appendHistoryEntry(draft.history, "Changes saved"),
    };

    try {
      const saved = await updateCar(payload);
      if (!mountedRef.current || sequence !== saveSeqRef.current) return;
      // A newer edit is already queued: let it win instead of clobbering it.
      if (pendingRef.current) {
        setSaveState("saving");
        return;
      }
      updateDrafts((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setSaveState("saved");
      setSaveError(null);
    } catch (error) {
      if (!mountedRef.current || sequence !== saveSeqRef.current) return;
      if (pendingRef.current) return;
      setSaveState("error");
      setSaveError(carErrorMessage(error, SAVE_ERROR_FALLBACK));
    }
  }, [updateDrafts]);

  const scheduleSave = useCallback(
    (draft: CarDraft) => {
      pendingRef.current = draft;
      setSaveState("saving");
      setSaveError(null);
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        void flushSave();
      }, AUTOSAVE_DELAY_MS);
    },
    [flushSave],
  );

  // Flush anything still pending when the page unmounts so an edit is not lost.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) {
        void updateCar({
          ...pending,
          history: appendHistoryEntry(pending.history, "Changes saved"),
        })
          .then(async (saved) => {
            if (!userId) return;
            const key = carDraftsCacheKey(userId);
            const cachedSnapshot = serverDataCache.get<CarDraft[]>(key);
            if (!cachedSnapshot) {
              await serverDataCache.fetch(key, listCars);
              return;
            }
            const cached = cachedSnapshot.data;
            serverDataCache.set(
              key,
              cached.some((draft) => draft.id === saved.id)
                ? cached.map((draft) => (draft.id === saved.id ? saved : draft))
                : [saved, ...cached],
            );
          })
          .catch((error: unknown) => {
            console.error("Unable to save pending CAR changes before leaving the page.", error);
          });
      }
    };
  }, [userId]);

  // Users without Supabase configuration or an authoring role never reach the network.
  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;
    let cancelled = false;
    const key = userId ? carDraftsCacheKey(userId) : null;
    const cached = key ? serverDataCache.get<CarDraft[]>(key) : undefined;
    if (cached) {
      setDrafts(cached.data);
      setSelectedDraftId((current) =>
        current && cached.data.some((car) => car.id === current)
          ? current
          : cached.data[0]?.id ?? null,
      );
    }
    setLoading(!cached);
    setLoadError(null);
    setRefreshError(null);
    const current = key ? serverDataCache.get<CarDraft[]>(key) : undefined;
    const shouldFetch = reloadToken > 0 || !current || !serverDataCache.isFresh(current, CAR_DATA_STALE_TIME);

    if (shouldFetch) void (key ? serverDataCache.fetch(key, listCars) : listCars())
      .then((cars) => {
        if (cancelled) return;
        if (key) serverDataCache.set(key, cars);
        updateDrafts(() => cars);
        setSelectedDraftId((current) =>
          current && cars.some((car) => car.id === current) ? current : cars[0]?.id ?? null,
        );
        setLoading(false);
        setLoadError(null);
        setRefreshError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (current) setRefreshError(carErrorMessage(error, LOAD_ERROR_FALLBACK));
        else setLoadError(carErrorMessage(error, LOAD_ERROR_FALLBACK));
        setLoading(false);
      });
    else setLoading(false);

    return () => {
      cancelled = true;
    };
  }, [enabled, reloadToken, userId]);

  // Source households (create-draft dropdown) and template versions.
  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;
    let cancelled = false;
    const key = userId ? householdListCacheKey(userId) : null;
    const cached = key
      ? serverDataCache.get<Awaited<ReturnType<typeof listHouseholds>>>(key)
      : undefined;
    if (cached) setHouseholds(deriveValidatedHouseholds(cached.data.households));
    setHouseholdsLoading(!cached);
    setHouseholdsError(null);
    setHouseholdsRefreshError(null);
    const current = key
      ? serverDataCache.get<Awaited<ReturnType<typeof listHouseholds>>>(key)
      : undefined;
    const shouldFetch =
      reloadToken > 0 ||
      !current ||
      !serverDataCache.isFresh(current, HOUSEHOLD_DATA_STALE_TIME);

    if (shouldFetch) void (key ? serverDataCache.fetch(key, listHouseholds) : listHouseholds())
      .then((result) => {
        if (cancelled) return;
        setHouseholds(deriveValidatedHouseholds(result.households));
        setHouseholdsError(null);
        setHouseholdsRefreshError(null);
        setHouseholdsLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (!current) {
          setHouseholds([]);
          setHouseholdsError(householdListError(error));
        } else {
          setHouseholdsRefreshError(householdListError(error));
        }
        setHouseholdsLoading(false);
      });

    // Template versions are a convenience: the editor stays usable without them.
    const templateKey = userId ? carTemplatesCacheKey(userId) : null;
    const cachedTemplates = templateKey ? serverDataCache.get<CarTemplateOption[]>(templateKey) : undefined;
    if (cachedTemplates) setTemplateVersions(cachedTemplates.data);
    const shouldFetchTemplates =
      !cachedTemplates || !serverDataCache.isFresh(cachedTemplates, CAR_DATA_STALE_TIME);
    if (shouldFetchTemplates) {
      void (templateKey ? serverDataCache.fetch(templateKey, listCarTemplates) : listCarTemplates())
        .then((options) => {
          if (!cancelled) setTemplateVersions(options);
        })
        .catch(() => {
          if (!cancelled && !cachedTemplates) setTemplateVersions([]);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [enabled, reloadToken, userId]);

  function reload() {
    setActionError(null);
    setCreateError(null);
    setReloadToken((token) => token + 1);
  }

  function updateDraft(update: Partial<CarDraft>) {
    if (!selectedDraft) return;
    const next: CarDraft = { ...selectedDraft, ...update };
    next.status = getDraftStatus(next, household);
    setDrafts((current) => current.map((item) => (item.id === next.id ? next : item)));
    scheduleSave(next);
  }

  /** Sets one template slot (manual edit or gap fill; `reason` marks an
   *  override of a derived value and keeps the original). */
  function updateSlot(key: string, value: string, reason?: string) {
    const def = SLOT_BY_KEY[key];
    if (!selectedDraft || !def) return;
    // The original of an override is the value currently on screen (derived
    // values are computed, never stored), so capture it from the resolution.
    const resolved = resolveSlotValues(selectedDraft, household)[key]?.value ?? "";
    updateDraft({
      slots: withSlotValue(selectedDraft.slots ?? {}, def, value, {
        ...(reason ? { reason } : {}),
        previous: resolved,
      }),
    });
  }

  /** Revealing a sensitive value is recorded in the draft history. */
  function revealSlot(key: string) {
    if (!selectedDraft) return;
    const def = SLOT_BY_KEY[key];
    if (!def) return;
    updateDraft({
      history: appendHistoryEntry(selectedDraft.history, `Revealed sensitive field: ${def.label}`),
    });
  }

  function updateFamilyMember(memberId: string, update: Partial<CarDraft["familyComposition"][number]>) {
    if (!selectedDraft) return;
    updateDraft({
      familyComposition: selectedDraft.familyComposition.map((member) =>
        member.id === memberId ? { ...member, ...update } : member,
      ),
    });
  }

  function updateIntervention(interventionId: string, update: Partial<CarDraft["interventions"][number]>) {
    if (!selectedDraft) return;
    updateDraft({
      interventions: selectedDraft.interventions.map((intervention) =>
        intervention.id === interventionId ? { ...intervention, ...update } : intervention,
      ),
    });
  }

  function addIntervention() {
    if (!selectedDraft) return;
    updateDraft({
      interventions: [...selectedDraft.interventions, customIntervention()],
    });
  }

  function removeIntervention(interventionId: string) {
    if (!selectedDraft) return;
    updateDraft({
      interventions: selectedDraft.interventions.filter(
        (intervention) => intervention.id !== interventionId,
      ),
    });
  }

  function selectDraft(draftId: string) {
    const changed = draftId !== selectedDraftId;
    if (pendingRef.current) void flushSave();
    setModeState("edit");
    if (!changed) return;
    setSelectedDraftId(draftId);
    setActionError(null);
    setSaveError(null);
    if (!pendingRef.current) setSaveState("idle");
  }

  function jumpToField(fieldId: string) {
    setModeState("edit");
    window.setTimeout(() => {
      const field = document.getElementById(fieldId);
      if (!field) return;
      field.scrollIntoView?.({ behavior: "smooth", block: "center" });
      field.focus();
    }, 0);
  }

  async function createCarDraft(householdId: string) {
    if (!householdId || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const draft = await createCar(householdId);
      if (!mountedRef.current) return;
      updateDrafts((current) => [draft, ...current]);
      setSelectedDraftId(draft.id);
      setModeState("edit");
      setSaveState("saved");
      setSaveError(null);
    } catch (error) {
      if (!mountedRef.current) return;
      setCreateError(
        carErrorMessage(error, "The CAR draft could not be created. Check your connection and try again."),
      );
    } finally {
      if (mountedRef.current) setCreating(false);
    }
  }

  async function deleteDraft() {
    const target = selectedDraft;
    if (!target || deleting) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteCar(target.id);
      if (!mountedRef.current) return;
      const remaining = drafts.filter((draft) => draft.id !== target.id);
      updateDrafts(() => remaining);
      setSelectedDraftId(remaining[0]?.id ?? null);
      setModeState("edit");
      setSaveState("idle");
      setSaveError(null);
    } catch (error) {
      if (!mountedRef.current) return;
      setActionError(
        carErrorMessage(error, "The CAR could not be deleted. Check your connection and try again."),
      );
    } finally {
      if (mountedRef.current) setDeleting(false);
    }
  }

  async function createRevision() {
    const target = selectedDraft;
    if (!target || creatingRevision) return;
    setCreatingRevision(true);
    setActionError(null);
    try {
      await flushSave();
      const revision = await createCarRevision(target.id);
      if (!mountedRef.current) return;
      updateDrafts((current) => [revision, ...current]);
      setSelectedDraftId(revision.id);
      setModeState("edit");
      setSaveState("saved");
      setSaveError(null);
    } catch (error) {
      if (!mountedRef.current) return;
      setActionError(
        carErrorMessage(error, "The new revision could not be created. Check your connection and try again."),
      );
    } finally {
      if (mountedRef.current) setCreatingRevision(false);
    }
  }

  return {
    drafts: ownedDrafts,
    loading,
    loadError,
    refreshError,
    notConfigured: !isSupabaseConfigured,
    reload,
    households: ownedHouseholds,
    householdsLoading,
    householdsError,
    householdsRefreshError,
    templateVersions,
    selectedDraft,
    household,
    checklist,
    missingItems,
    history: selectedDraft?.history ?? [],
    saveState,
    saveError,
    createError,
    actionError,
    creating,
    deleting,
    creatingRevision,
    mode,
    selectDraft,
    createCarDraft,
    createRevision,
    deleteDraft,
    updateDraft,
    updateFamilyMember,
    updateIntervention,
    addIntervention,
    removeIntervention,
    jumpToField,
    setMode: setModeState,
    updateSlot,
    revealSlot,
  };
}
