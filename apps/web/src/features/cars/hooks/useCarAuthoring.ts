import { useEffect, useMemo, useState } from "react";
import { mockInitialCarDrafts, mockTemplateVersions, mockValidatedHouseholds } from "../mock-data";
import { createFamilyComposition, createIntervention, getCarChecklist, getDraftStatus } from "../lib/car-draft";
import type { CarDraft, CarDraftHistoryEntry } from "../types";

function createDraftId() {
  return `car-draft-${Date.now()}`;
}

function newDraftReference(drafts: CarDraft[]) {
  const latest = drafts.reduce((maximum, draft) => {
    const sequence = Number(draft.reference.split("-").at(-1)) || 0;
    return Math.max(maximum, sequence);
  }, 0);
  return `CAR-2026-${String(latest + 1).padStart(3, "0")}`;
}

function newDraft(householdId: string, drafts: CarDraft[]): CarDraft | null {
  const household = mockValidatedHouseholds.find((record) => record.id === householdId);
  if (!household) return null;
  const now = new Date().toISOString();
  return {
    id: createDraftId(),
    reference: newDraftReference(drafts),
    householdId: household.id,
    granteeMemberId: household.grantee.id,
    revision: 1,
    status: "draft_incomplete",
    templateVersion: "",
    datePrepared: "",
    presentingProblem: "",
    backgroundInformation: "",
    assessment: "",
    interventions: [createIntervention()],
    recommendation: "",
    familyComposition: household.members.map((member) => ({
      id: member.id,
      entryId: member.entryId,
      name: member.name,
      age: member.age,
      relationship: member.relationship,
      sourceRow: member.sourceRow,
      include: true,
    })),
    createdAt: now,
    updatedAt: now,
  };
}

export function useCarAuthoring() {
  const [drafts, setDrafts] = useState<CarDraft[]>(mockInitialCarDrafts);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(mockInitialCarDrafts[0]?.id ?? null);
  const [history, setHistory] = useState<Record<string, CarDraftHistoryEntry[]>>(() =>
    Object.fromEntries(
      mockInitialCarDrafts.map((draft) => [
        draft.id,
        [{ id: `${draft.id}-created`, label: "Draft created", at: draft.createdAt }],
      ]),
    ),
  );
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [previewOpen, setPreviewOpen] = useState(false);

  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId) ?? null;
  const household = selectedDraft
    ? mockValidatedHouseholds.find((record) => record.id === selectedDraft.householdId) ?? null
    : null;
  const checklist = useMemo(
    () => (selectedDraft ? getCarChecklist(selectedDraft) : []),
    [selectedDraft],
  );
  const missingItems = checklist.filter((item) => !item.complete);

  useEffect(() => {
    if (!selectedDraft || saveState !== "saving") return;
    const timeout = window.setTimeout(() => {
      setDrafts((current) =>
        current.map((draft) =>
          draft.id === selectedDraft.id
            ? {
                ...draft,
                status: getDraftStatus(draft),
                updatedAt: new Date().toISOString(),
              }
            : draft,
        ),
      );
      const savedAt = new Date().toISOString();
      setHistory((current) => ({
        ...current,
        [selectedDraft.id]: [
          { id: `${selectedDraft.id}-${savedAt}`, label: "Autosaved locally", at: savedAt },
          ...(current[selectedDraft.id] ?? []),
        ].slice(0, 8),
      }));
      setSaveState("saved");
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [selectedDraft, saveState]);

  function updateDraft(update: Partial<CarDraft>) {
    if (!selectedDraft) return;
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === selectedDraft.id
          ? {
              ...draft,
              ...update,
              status: getDraftStatus({ ...draft, ...update }),
            }
          : draft,
      ),
    );
    setSaveState("saving");
  }

  function createCarDraft(householdId: string) {
    const draft = newDraft(householdId, drafts);
    if (!draft) return;
    setDrafts((current) => [draft, ...current]);
    setHistory((current) => ({
      ...current,
      [draft.id]: [{ id: `${draft.id}-created`, label: "Draft created", at: draft.createdAt }],
    }));
    setSelectedDraftId(draft.id);
    setPreviewOpen(false);
    setSaveState("saved");
  }

  function updateFamilyMember(memberId: string, update: Partial<CarDraft["familyComposition"][number]>) {
    if (!selectedDraft) return;
    updateDraft({
      familyComposition: createFamilyComposition(
        selectedDraft.familyComposition.map((member) =>
          member.id === memberId ? { ...member, ...update } : member,
        ),
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
    updateDraft({ interventions: [...selectedDraft.interventions, createIntervention()] });
  }

  function removeIntervention(interventionId: string) {
    if (!selectedDraft) return;
    updateDraft({
      interventions: selectedDraft.interventions.filter((intervention) => intervention.id !== interventionId),
    });
  }

  function selectDraft(draftId: string) {
    setSelectedDraftId(draftId);
    setPreviewOpen(false);
    setSaveState("saved");
  }

  function jumpToField(fieldId: string) {
    setPreviewOpen(false);
    window.setTimeout(() => {
      const field = document.getElementById(fieldId);
      if (!field) return;
      field.scrollIntoView?.({ behavior: "smooth", block: "center" });
      field.focus();
    }, 0);
  }

  function createRevision() {
    if (!selectedDraft || !household) return;
    const now = new Date().toISOString();
    const revision: CarDraft = {
      ...selectedDraft,
      id: createDraftId(),
      reference: selectedDraft.reference,
      revision: selectedDraft.revision + 1,
      status: "draft_incomplete",
      familyComposition: createFamilyComposition(selectedDraft.familyComposition),
      interventions: selectedDraft.interventions.map((intervention) => ({ ...intervention })),
      createdAt: now,
      updatedAt: now,
    };
    setDrafts((current) => [revision, ...current]);
    setHistory((current) => ({
      ...current,
      [revision.id]: [
        { id: `${revision.id}-created`, label: `Revision ${revision.revision} created from draft`, at: now },
      ],
    }));
    setSelectedDraftId(revision.id);
    setPreviewOpen(false);
    setSaveState("saved");
  }

  return {
    drafts,
    selectedDraft,
    household,
    checklist,
    missingItems,
    history: selectedDraft ? history[selectedDraft.id] ?? [] : [],
    saveState,
    previewOpen,
    validatedHouseholds: mockValidatedHouseholds,
    templateVersions: mockTemplateVersions,
    selectDraft,
    createCarDraft,
    createRevision,
    updateDraft,
    updateFamilyMember,
    updateIntervention,
    addIntervention,
    removeIntervention,
    jumpToField,
    setPreviewOpen,
  };
}
