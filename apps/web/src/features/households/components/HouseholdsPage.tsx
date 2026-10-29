import React, { useMemo, useState } from "react";
import { useAuth } from "../../../app/providers";
import { mockHouseholds, type HouseholdRecord } from "../mock-data";
import { normalizeGrantee } from "@import-domain";

type GranteeStatus = "valid" | "none" | "multiple" | "invalid" | "blank";
type ReviewFilter = "all" | "needs_review" | "ok" | "resolved";

type OverlayEvent = {
  action: "Grantee corrected" | "Member excluded" | "Member restored";
  actor: string;
  reason: string;
  memberName: string;
  beforeValue: string;
  afterValue: string;
  at: string;
};

type HouseholdOverlay = {
  selectedGranteeId?: string;
  excludedMemberIds: string[];
  events: OverlayEvent[];
};

function getGranteeStatus(household: HouseholdRecord, excludedMemberIds: string[] = []): GranteeStatus {
  const parsed = household.members
    .filter((member) => !excludedMemberIds.includes(member.id))
    .map((member) => ({
      raw: member.granteeFlag.trim(),
      value: normalizeGrantee(member.granteeFlag),
    }));
  const yesCount = parsed.filter((member) => member.value === true).length;
  const invalidCount = parsed.filter((member) => member.raw !== "" && member.value === null).length;
  const blankCount = parsed.filter((member) => member.raw === "").length;

  if (yesCount > 1) return "multiple";
  if (yesCount === 1 && invalidCount > 0) return "invalid";
  if (yesCount === 1 && blankCount > 0) return "blank";
  if (yesCount === 1) return "valid";
  if (invalidCount > 0) return "invalid";
  if (blankCount > 0) return "blank";
  return "none";
}

function StatusLabel({ status }: { status: GranteeStatus | "resolved" }) {
  const labels = {
    valid: "Grantee OK",
    none: "No Yes flag",
    multiple: "Multiple Yes flags",
    invalid: "Unsupported value",
    blank: "Blank flag",
    resolved: "Resolved by staff",
  } as const;
  const styles = {
    valid: "border-[#2f5b3a] bg-[#e6ecdf] text-[#244b2e]",
    resolved: "border-[#2f5b3a] bg-[#e6ecdf] text-[#244b2e]",
    none: "border-[#8a5a00] bg-[#f3ead8] text-[#704700]",
    multiple: "border-[#7a1f1f] bg-[#f2e4e1] text-[#7a1f1f]",
    invalid: "border-[#8a5a00] bg-[#f3ead8] text-[#704700]",
    blank: "border-[#8a5a00] bg-[#f3ead8] text-[#704700]",
  } as const;

  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-1 text-[11px] font-medium ${styles[status]}`}>
      <span aria-hidden="true">{status === "valid" || status === "resolved" ? "✓" : "!"}</span>
      {labels[status]}
    </span>
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function HouseholdsPage() {
  const { user, profile, roles } = useAuth();
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

  const canCorrect = roles.some((role) => ["admin", "case_worker", "reviewer"].includes(role));
  const canView = roles.some((role) =>
    ["admin", "operator", "case_worker", "reviewer", "auditor"].includes(role),
  );
  const actor = profile?.display_name || user?.email || "Signed-in staff";

  if (!canView) {
    return (
      <div role="alert" className="max-w-[680px] border-l-4 border-[#7a1f1f] border-y border-r border-[#7a1f1f] bg-[#f2e4e1] px-4 py-4">
        <h1 className="font-serif text-2xl">You do not have access to household records</h1>
        <p className="mt-2 text-sm leading-6 text-[#3f3b34]">
          Ask an administrator to review your account role. No household details are shown.
        </p>
      </div>
    );
  }

  const visibleHouseholds = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return mockHouseholds.filter((household) => {
      const overlay = overlays[household.id];
      const status = overlay?.selectedGranteeId
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
      return matchesSearch && matchesStatus && matchesVersion;
    });
  }, [overlays, query, reviewFilter, versionFilter]);

  const selected =
    visibleHouseholds.find((household) => household.id === selectedId) ?? visibleHouseholds[0] ?? null;
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
    const current = overlays[household.id];
    return current?.selectedGranteeId
      ? false
      : getGranteeStatus(household, current?.excludedMemberIds) !== "valid";
  }).length;
  const granteeCount = mockHouseholds.filter((household) => {
    const current = overlays[household.id];
    return (
      Boolean(current?.selectedGranteeId) ||
      getGranteeStatus(household, current?.excludedMemberIds) === "valid"
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
    if (!member) return;

    recordOverlay(
      selected.id,
      {
        action: "Grantee corrected",
        actor,
        reason: resolutionReason.trim(),
        memberName: member.name,
        beforeValue: selected.members
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
    if (!member) return;
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

  return (
    <div>
      <header className="border-b border-[#161512] pb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e]">
          F4 / Household register
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl leading-none tracking-tight sm:text-5xl">Households</h1>
            <p className="mt-3 max-w-[62ch] text-sm leading-6 text-[#3f3b34]">
              Check household members and resolve GRANTEE conflicts against the imported source rows.
            </p>
          </div>
          <span className="border border-[#8a5a00] bg-[#f3ead8] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#704700]">
            Mock records · local changes reset on reload
          </span>
        </div>
      </header>

      <section aria-label="Sample register summary" className="grid grid-cols-2 gap-5 border-b border-[#c9c3b6] py-5 sm:grid-cols-4">
        <SummaryValue label="Sample households" value={mockHouseholds.length} />
        <SummaryValue label="Members in sample" value={totalMembers} />
        <SummaryValue label="Grantee OK" value={granteeCount} />
        <SummaryValue label="Needs review" value={needsReviewCount} emphasis />
      </section>

      <section aria-label="Household search and filters" className="border-b border-[#c9c3b6] py-5">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1.5fr)_minmax(160px,1fr)_minmax(180px,1fr)]">
          <div>
            <label htmlFor="household-search" className="mb-1 block text-xs font-semibold">Search households</label>
            <input
              id="household-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="HH_ID, member name, or barangay"
              className="min-h-[44px] w-full border border-[#8c877c] bg-[#f8f5ee] px-3 text-sm placeholder:text-[#777166] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7a1f1f]"
            />
          </div>
          <div>
            <label htmlFor="review-filter" className="mb-1 block text-xs font-semibold">Grantee status</label>
            <select
              id="review-filter"
              value={reviewFilter}
              onChange={(event) => setReviewFilter(event.target.value as ReviewFilter)}
              className="min-h-[44px] w-full border border-[#8c877c] bg-[#f8f5ee] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7a1f1f]"
            >
              <option value="all">All households</option>
              <option value="needs_review">Needs review</option>
              <option value="ok">Grantee OK</option>
              <option value="resolved">Resolved by staff</option>
            </select>
          </div>
          <div>
            <label htmlFor="import-filter" className="mb-1 block text-xs font-semibold">Import version</label>
            <select
              id="import-filter"
              value={versionFilter}
              onChange={(event) => setVersionFilter(event.target.value)}
              className="min-h-[44px] w-full border border-[#8c877c] bg-[#f8f5ee] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7a1f1f]"
            >
              <option value="all">All versions</option>
              <option value="3">SY2026 Q1 · v3</option>
              <option value="2">Region IV-A · v2</option>
            </select>
          </div>
        </div>
        <p className="mt-3 text-xs text-[#5b574e]" aria-live="polite">
          Showing {visibleHouseholds.length} of {mockHouseholds.length} sample households
        </p>
      </section>

      {feedback && (
        <p role="status" className="mt-4 border-l-4 border-[#2f5b3a] bg-[#e6ecdf] px-4 py-3 text-sm leading-6 text-[#244b2e]">
          {feedback}
        </p>
      )}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.7fr)]">
        <section aria-labelledby="household-list-heading" className="min-w-0">
          <div className="flex items-baseline justify-between border-b border-[#161512] pb-2">
            <h2 id="household-list-heading" className="font-serif text-xl">Household list</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5b574e]">
              {visibleHouseholds.length} shown
            </span>
          </div>
          {visibleHouseholds.length === 0 ? (
            <div className="border-b border-[#c9c3b6] px-3 py-8">
              <p className="font-serif text-lg">No households match those filters.</p>
              <p className="mt-1 text-sm leading-6 text-[#5b574e]">Clear the search or choose a different import version.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#c9c3b6]">
              {visibleHouseholds.map((household) => {
                const overlay = overlays[household.id];
                const status = overlay?.selectedGranteeId
                  ? "resolved"
                  : getGranteeStatus(household, overlay?.excludedMemberIds);
                const isSelected = household.id === selected?.id;
                return (
                  <li key={household.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => selectHousehold(household.id)}
                      className={`w-full border-l-4 px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7a1f1f] ${
                        isSelected ? "border-[#7a1f1f] bg-[#ece7dc]" : "border-transparent hover:bg-[#f8f5ee]"
                      }`}
                    >
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-sm font-semibold tabular-nums">HH_ID {household.hhId}</span>
                        <span className="text-xs text-[#5b574e]">{household.members.length} members</span>
                      </span>
                      <span className="mt-1 block text-xs text-[#5b574e]">
                        {household.barangay} · Import v{household.importVersion}
                      </span>
                      <span className="mt-2 block"><StatusLabel status={status} /></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="household-detail-heading" className="min-w-0 border border-[#c9c3b6] bg-[#f8f5ee]">
          {!selected ? (
            <div className="px-5 py-10">
              <h2 className="font-serif text-2xl">Select a household</h2>
              <p className="mt-2 text-sm leading-6 text-[#5b574e]">Choose a row to inspect member details and source references.</p>
            </div>
          ) : (
            <>
              <div className="border-b border-[#c9c3b6] px-4 py-4 sm:px-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5b574e]">
                  Household detail / {selected.importName} · version {selected.importVersion}
                </p>
                <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="household-detail-heading" className="font-mono text-2xl font-semibold tabular-nums">
                      HH_ID {selected.hhId}
                    </h2>
                    <p className="mt-1 text-sm text-[#3f3b34]">{selected.barangay}, {selected.municipality}</p>
                  </div>
                  {selectedStatus && <StatusLabel status={selectedStatus} />}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#e2ddd1] pt-3">
                  <p className="text-sm">
                    <span className="font-semibold">Grantee:</span>{" "}
                    {activeGrantee ? `${activeGrantee.name} · source row ${activeGrantee.sourceRow}` : "Not validated"}
                  </p>
                  {selectedStatus === "valid" && (
                    <span className="text-xs font-medium text-[#244b2e]">Exactly one supported Yes flag</span>
                  )}
                  {canCorrect && selectedStatus !== "valid" && selectedStatus !== "resolved" && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowResolveForm(!showResolveForm);
                        setCandidateId("");
                        setResolutionReason("");
                        setExcludeMemberId(null);
                        setExclusionReason("");
                      }}
                      className="min-h-[40px] border border-[#161512] px-3 py-2 text-xs font-semibold hover:bg-[#161512] hover:text-[#f4f1ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
                    >
                      {showResolveForm ? "Cancel correction" : "Resolve grantee"}
                    </button>
                  )}
                </div>
              </div>

              {showResolveForm && canCorrect && (
                <form onSubmit={saveResolution} className="border-b border-[#c9c3b6] bg-[#f3ead8] px-4 py-4 sm:px-5">
                  <h3 className="font-semibold">Choose the verified grantee</h3>
                  <p className="mt-1 text-xs leading-5 text-[#5b574e]">
                    No member is preselected. This creates a mock correction overlay; imported flags stay as recorded.
                  </p>
                  <fieldset className="mt-3 space-y-2">
                    <legend className="sr-only">Select one household member as the grantee</legend>
                    {selected.members.map((member) => {
                      const isExcluded = selectedOverlay?.excludedMemberIds.includes(member.id) ?? false;
                      return (
                        <label key={member.id} className="flex min-h-[44px] items-center gap-3 border border-[#d6cdb9] bg-[#f8f5ee] px-3 py-2 text-sm">
                        <input
                          type="radio"
                          name="grantee-candidate"
                          value={member.id}
                          checked={candidateId === member.id}
                          onChange={(event) => setCandidateId(event.target.value)}
                          disabled={isExcluded}
                          required
                          className="h-4 w-4 accent-[#7a1f1f]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{member.name}</span>
                          <span className="text-xs text-[#5b574e]">
                            {member.relationship} · source row {member.sourceRow} · imported flag: {member.granteeFlag || "Blank"}
                            {isExcluded ? " · excluded from this household" : ""}
                          </span>
                        </span>
                      </label>
                      );
                    })}
                  </fieldset>
                  <label htmlFor="resolution-reason" className="mt-3 block text-xs font-semibold">
                    Reason for correction
                  </label>
                  <textarea
                    id="resolution-reason"
                    value={resolutionReason}
                    onChange={(event) => setResolutionReason(event.target.value)}
                    required
                    rows={2}
                    className="mt-1 w-full border border-[#8c877c] bg-[#f8f5ee] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
                    placeholder="Record what was checked and why this member was selected."
                  />
                  <button
                    type="submit"
                    disabled={!candidateId || !resolutionReason.trim()}
                    className="mt-3 min-h-[44px] border border-[#161512] bg-[#161512] px-4 py-2 text-sm font-medium text-white hover:bg-[#7a1f1f] disabled:cursor-not-allowed disabled:border-[#b5afa2] disabled:bg-[#b5afa2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
                  >
                    Record local correction
                  </button>
                </form>
              )}

              <div className="border-b border-[#c9c3b6] px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-serif text-lg">Household members</h3>
                  <p className="text-xs text-[#5b574e]">Source row links are retained; no imported row is removed.</p>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-[#ece7dc]">
                        {["Member", "Relationship", "Age", "GRANTEE", "Source"].map((heading) => (
                          <th key={heading} scope="col" className="border-b border-[#c9c3b6] px-2 py-2 font-mono text-[10px] uppercase tracking-[0.08em]">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selected.members.map((member) => {
                        const excluded = selectedOverlay?.excludedMemberIds.includes(member.id) ?? false;
                        const isGrantee = activeGrantee?.id === member.id;
                        return (
                          <tr key={member.id} className={excluded ? "bg-[#ece7dc] text-[#777166]" : "odd:bg-[#fbf9f4]"}>
                            <th scope="row" className="border-b border-[#e2ddd1] px-2 py-3 font-medium">
                              <span className={excluded ? "line-through" : ""}>{member.name}</span>
                              {isGrantee && <span className="ml-2 inline-block text-[10px] font-semibold text-[#244b2e]">GRANTEE</span>}
                              {excluded && <span className="ml-2 inline-block border border-[#777166] px-1 text-[9px] uppercase">Excluded overlay</span>}
                            </th>
                            <td className="border-b border-[#e2ddd1] px-2 py-3">{member.relationship}</td>
                            <td className="border-b border-[#e2ddd1] px-2 py-3 tabular-nums">{member.age}</td>
                            <td className="border-b border-[#e2ddd1] px-2 py-3 font-mono">{member.granteeFlag || "Blank"}</td>
                            <td className="border-b border-[#e2ddd1] px-2 py-3">
                              <span className="font-mono text-xs">Row {member.sourceRow}</span>
                              {canCorrect && (
                                <span className="ml-2 inline-block">
                                  {excluded ? (
                                    <button
                                      type="button"
                                      onClick={() => restoreMember(member.id)}
                                      className="min-h-[32px] text-xs underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
                                    >
                                      Restore
                                    </button>
                                  ) : excludeMemberId === member.id ? null : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExcludeMemberId(member.id);
                                        setExclusionReason("");
                                        setShowResolveForm(false);
                                        setCandidateId("");
                                        setResolutionReason("");
                                      }}
                                      className="min-h-[32px] text-xs underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
                                    >
                                      Exclude…
                                    </button>
                                  )}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {excludeMemberId && canCorrect && (
                  <form onSubmit={saveExclusion} className="mt-3 border-l-4 border-[#8a5a00] bg-[#f3ead8] px-3 py-3">
                    <p className="text-sm font-semibold">
                      Exclude {selected.members.find((member) => member.id === excludeMemberId)?.name} from this household view?
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#5b574e]">This mock overlay does not delete the source row. A reason is required.</p>
                    <label htmlFor="exclusion-reason" className="sr-only">Reason for exclusion</label>
                    <textarea
                      id="exclusion-reason"
                      value={exclusionReason}
                      onChange={(event) => setExclusionReason(event.target.value)}
                      required
                      rows={2}
                      className="mt-2 w-full border border-[#8c877c] bg-[#f8f5ee] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
                      placeholder="Reason for excluding this member"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={!exclusionReason.trim()}
                        className="min-h-[40px] border border-[#161512] bg-[#161512] px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:border-[#b5afa2] disabled:bg-[#b5afa2]"
                      >
                        Record local exclusion
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExcludeMemberId(null);
                          setExclusionReason("");
                        }}
                        className="min-h-[40px] px-3 py-2 text-xs underline underline-offset-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
                <section aria-labelledby="household-history-heading">
                  <h3 id="household-history-heading" className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                    Correction history
                  </h3>
                  {(selectedOverlay?.events.length ?? 0) === 0 ? (
                    <p className="mt-2 text-sm text-[#5b574e]">No local overlays recorded for this household.</p>
                  ) : (
                    <ol className="mt-2 space-y-3">
                      {selectedOverlay?.events.slice().reverse().map((entry, index) => (
                        <li key={`${entry.at}-${index}`} className="border-l-2 border-[#8a5a00] pl-3">
                          <p className="text-sm font-semibold">{entry.action} · {entry.memberName}</p>
                          <p className="mt-1 text-xs leading-5 text-[#5b574e]">{entry.reason}</p>
                          <p className="mt-1 text-xs text-[#5b574e]">Before: {entry.beforeValue} · After: {entry.afterValue}</p>
                          <p className="mt-1 font-mono text-[10px] text-[#5b574e]">{entry.actor} · {formatTime(entry.at)}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
                <section aria-labelledby="linked-cars-heading">
                  <h3 id="linked-cars-heading" className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                    Linked CARs
                  </h3>
                  {selected.car ? (
                    <details className="mt-2 border border-[#c9c3b6] bg-[#fbf9f4]">
                      <summary className="min-h-[44px] cursor-pointer px-3 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]">
                        {selected.car.reference} <span className="ml-2 text-xs text-[#5b574e]">{selected.car.status}</span>
                      </summary>
                      <p className="border-t border-[#e2ddd1] px-3 py-2 text-xs leading-5 text-[#5b574e]">
                        Mock CAR reference only. CAR authoring and review are not connected in this UI.
                      </p>
                    </details>
                  ) : (
                    <p className="mt-2 text-sm text-[#5b574e]">No CAR is linked in this sample record.</p>
                  )}
                </section>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryValue({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className="border-t border-[#161512] pt-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5b574e]">{label}</p>
      <p className={`mt-1 font-serif text-2xl tabular-nums ${emphasis ? "text-[#7a1f1f]" : ""}`}>{value}</p>
    </div>
  );
}
