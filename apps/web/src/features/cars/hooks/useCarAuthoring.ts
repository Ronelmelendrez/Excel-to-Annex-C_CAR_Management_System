import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeGrantee } from "@import-domain";
import { householdListError, listHouseholds } from "../../households/api";
import { getGranteeStatus } from "../../households/lib/households";
import type { HouseholdRecord } from "../../households/types";
import { isSupabaseConfigured } from "../../../shared/supabase";
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

const LOAD_ERROR_FALLBACK =
  "CAR drafts could not be loaded. Check your connection and that the cars function is deployed.";
const SAVE_ERROR_FALLBACK =
  "Your changes could not be saved to Supabase. Check your connection and try again.";

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

export function useCarAuthoring(enabled = true) {
  const [drafts, setDrafts] = useState<CarDraft[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured && enabled);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [households, setHouseholds] = useState<ValidatedHousehold[]>([]);
  const [householdsError, setHouseholdsError] = useState<string | null>(null);
  const [templateVersions, setTemplateVersions] = useState<CarTemplateOption[]>([]);

  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
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

  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId) ?? null;

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
      setDrafts((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setSaveState("saved");
      setSaveError(null);
    } catch (error) {
      if (!mountedRef.current || sequence !== saveSeqRef.current) return;
      if (pendingRef.current) return;
      setSaveState("error");
      setSaveError(carErrorMessage(error, SAVE_ERROR_FALLBACK));
    }
  }, []);

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
        }).catch(() => undefined);
      }
    };
  }, []);

  // Users without Supabase configuration or an authoring role never reach the network.
  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listCars()
      .then((cars) => {
        if (cancelled) return;
        setDrafts(cars);
        setSelectedDraftId((current) =>
          current && cars.some((car) => car.id === current) ? current : cars[0]?.id ?? null,
        );
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(carErrorMessage(error, LOAD_ERROR_FALLBACK));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, reloadToken]);

  // Source households (create-draft dropdown) and template versions.
  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;
    let cancelled = false;

    listHouseholds()
      .then((result) => {
        if (cancelled) return;
        setHouseholds(deriveValidatedHouseholds(result.households));
        setHouseholdsError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setHouseholds([]);
        setHouseholdsError(householdListError(error));
      });

    // Template versions are a convenience: the editor stays usable without them.
    listCarTemplates()
      .then((options) => {
        if (!cancelled) setTemplateVersions(options);
      })
      .catch(() => {
        if (!cancelled) setTemplateVersions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, reloadToken]);

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
      setDrafts((current) => [draft, ...current]);
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
      setDrafts(remaining);
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
      setDrafts((current) => [revision, ...current]);
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
    drafts,
    loading,
    loadError,
    notConfigured: !isSupabaseConfigured,
    reload,
    households,
    householdsError,
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
