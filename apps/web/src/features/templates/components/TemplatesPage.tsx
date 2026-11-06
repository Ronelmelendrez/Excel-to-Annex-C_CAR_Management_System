import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/providers";
import { normalizeGrantee } from "@import-domain";
import { CarReportDocument } from "../../cars/components/report/CarReportDocument";
import { listCars } from "../../cars/api";
import { getCarChecklist } from "../../cars/lib/car-draft";
import type { CarDraft, ValidatedHousehold } from "../../cars/types";
import { householdListError, listHouseholds } from "../../households/api";
import { getGranteeStatus } from "../../households/lib/households";
import { annexCDocxFileName, downloadDocx, renderAnnexCDocx } from "../lib/annex-c-docx";
import { synthesizeDraft } from "../lib/synthesize-draft";
import { PageDataSkeleton } from "../../../components/ui/PageSkeletons";
import {
  carDraftsCacheKey,
  householdListCacheKey,
  serverDataCache,
} from "../../../shared/server-data-cache";

const REPORT_DATA_STALE_TIME = 30_000;

/** Households the register marks as a valid CAR source (exactly one grantee). */
function deriveValidatedHouseholds(
  households: Awaited<ReturnType<typeof listHouseholds>>["households"],
): ValidatedHousehold[] {
  return households.flatMap((household) => {
    if (getGranteeStatus(household) !== "valid") return [];
    const grantee = household.members.find(
      (member) => normalizeGrantee(member.granteeFlag) === true,
    );
    return grantee ? [{ ...household, grantee }] : [];
  });
}

/**
 * Annex C report generator (REQ-RPT-001..014): pick a validated household,
 * preview the report rendered from the versioned template definition, and
 * download a .docx filled from the real source Word template. Read-only —
 * nothing here writes to the household register or creates CAR records.
 */
export function TemplatesPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const householdKey = userId ? householdListCacheKey(userId) : "";
  const carKey = userId ? carDraftsCacheKey(userId) : "";
  const [dataOwnerId, setDataOwnerId] = useState(userId);
  const [households, setHouseholds] = useState<ValidatedHousehold[]>(() => {
    if (!householdKey) return [];
    const cached = serverDataCache.get<Awaited<ReturnType<typeof listHouseholds>>>(householdKey);
    return cached ? deriveValidatedHouseholds(cached.data.households) : [];
  });
  const [loading, setLoading] = useState(
    () => !householdKey || !serverDataCache.get(householdKey),
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cars, setCars] = useState<CarDraft[]>(
    () => (carKey ? serverDataCache.get<CarDraft[]>(carKey)?.data : undefined) ?? [],
  );
  const [carsNote, setCarsNote] = useState<string | null>(null);
  const [householdRefreshNotice, setHouseholdRefreshNotice] = useState<string | null>(null);
  const [carsRefreshNotice, setCarsRefreshNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const ownerMatches = dataOwnerId === userId;

  useLayoutEffect(() => {
    if (ownerMatches) return;
    setDataOwnerId(userId);
    const householdCache = householdKey
      ? serverDataCache.get<Awaited<ReturnType<typeof listHouseholds>>>(householdKey)
      : undefined;
    setHouseholds(householdCache ? deriveValidatedHouseholds(householdCache.data.households) : []);
    setLoading(!householdCache);
    setLoadError(null);
    setCars(carKey ? serverDataCache.get<CarDraft[]>(carKey)?.data ?? [] : []);
    setCarsNote(null);
    setHouseholdRefreshNotice(null);
    setCarsRefreshNotice(null);
    setSelectedId(null);
  }, [carKey, householdKey, ownerMatches, userId]);

  useEffect(() => {
    let cancelled = false;
    if (!ownerMatches) return;
    const key = householdKey || null;
    const cached = key
      ? serverDataCache.get<Awaited<ReturnType<typeof listHouseholds>>>(key)
      : undefined;
    if (cached) {
      const validated = deriveValidatedHouseholds(cached.data.households);
      setHouseholds(validated);
      setSelectedId((current) =>
        current && validated.some((household) => household.id === current)
          ? current
          : validated[0]?.id ?? null,
      );
    }
    setLoading(!cached);
    setLoadError(null);
    const current = key
      ? serverDataCache.get<Awaited<ReturnType<typeof listHouseholds>>>(key)
      : undefined;
    const shouldFetch =
      reloadToken > 0 ||
      !current ||
      !serverDataCache.isFresh(current, REPORT_DATA_STALE_TIME);

    if (shouldFetch) void (key ? serverDataCache.fetch(key, listHouseholds) : listHouseholds())
      .then((response) => {
        if (cancelled) return;
        const validated = deriveValidatedHouseholds(response.households);
        setHouseholds(validated);
        setSelectedId((current) =>
          current && validated.some((household) => household.id === current)
            ? current
            : (validated[0]?.id ?? null),
        );
        setLoading(false);
        setHouseholdRefreshNotice(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (!current) setLoadError(householdListError(error));
        else setHouseholdRefreshNotice("Household records could not be refreshed. Showing the last loaded records.");
        setLoading(false);
      });
    else setLoading(false);

    return () => {
      cancelled = true;
    };
  }, [householdKey, ownerMatches, reloadToken]);

  /** Saved CARs make the preview reflect the case worker's slot edits; the
   *  register alone still produces a full synthesized preview. */
  useEffect(() => {
    let cancelled = false;
    if (!ownerMatches) return;
    const key = carKey || null;
    const cached = key ? serverDataCache.get<CarDraft[]>(key) : undefined;
    if (cached) setCars(cached.data);
    const shouldFetch =
      reloadToken > 0 ||
      !cached ||
      !serverDataCache.isFresh(cached, REPORT_DATA_STALE_TIME);

    if (shouldFetch) void (key ? serverDataCache.fetch(key, listCars) : listCars())
      .then((saved) => {
        if (!cancelled) {
          setCars(saved);
          setCarsNote(null);
          setCarsRefreshNotice(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (!cached) {
            setCars([]);
            setCarsNote(
              "Saved CAR drafts could not be loaded. This preview uses the imported household information.",
            );
          } else {
            setCarsRefreshNotice("Saved CAR drafts could not be refreshed. Showing the last loaded records.");
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [carKey, ownerMatches, reloadToken]);

  const ownedHouseholds = ownerMatches ? households : [];
  const ownedCars = ownerMatches ? cars : [];
  const household = useMemo(
    () => ownedHouseholds.find((item) => item.id === selectedId) ?? ownedHouseholds[0] ?? null,
    [ownedHouseholds, selectedId],
  );

  const draft = useMemo(() => {
    if (!household) return null;
    const saved = ownedCars.find((car) => car.householdId === household.id);
    return saved ?? synthesizeDraft(household);
  }, [household, ownedCars]);

  const checklist = useMemo(
    () => (draft && household ? getCarChecklist(draft, household) : []),
    [draft, household],
  );
  const missing = checklist.filter((item) => !item.complete);

  async function handleDownload() {
    if (!draft || !household || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    setDownloaded(false);
    try {
      const bytes = await renderAnnexCDocx(draft, household);
      downloadDocx(bytes, annexCDocxFileName(draft));
      setDownloaded(true);
    } catch (error) {
      console.error("Unable to prepare the Annex C Word document.", error);
      setDownloadError(
        "The Annex C Word document could not be prepared. Try again. If the problem continues, contact your system administrator.",
      );
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6">
        <header className="border-b border-[#c9c3b6] pb-4">
          <h1 className="font-serif text-3xl">Annex C report generator</h1>
          <p className="mt-2 max-w-[75ch] text-sm leading-6 text-[#3f3b34]">
            Choose a household with a confirmed grantee, review its Annex C case study report, and
            download a Word document using the official template.
          </p>
        </header>
        <PageDataSkeleton page="reports" />
      </div>
    );
  }

  if (!ownerMatches) {
    return (
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6">
        <PageDataSkeleton page="reports" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6">
        <div
          role="alert"
          className="max-w-[680px] border-l-4 border-[#7a1f1f] border-y border-r border-[#7a1f1f] bg-[#f2e4e1] px-4 py-4"
        >
          <h1 className="font-serif text-2xl">Report generator unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-[#3f3b34]">{loadError}</p>
          <button
            type="button"
            onClick={() => setReloadToken((token) => token + 1)}
            className="mt-3 min-h-[40px] border border-[#161512] bg-[#161512] px-4 py-2 text-sm font-medium text-[#f4f1ea] hover:bg-[#7a1f1f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!household || !draft) {
    return (
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6">
        <h1 className="font-serif text-3xl">Annex C report generator</h1>
        <p className="mt-4 max-w-[70ch] text-sm leading-6 text-[#3f3b34]">
          No household is ready for a report yet. A household qualifies when the register
          marks exactly one member as the grantee.
        </p>
        <button
          type="button"
          onClick={() => setReloadToken((token) => token + 1)}
          className="mt-4 min-h-[40px] border border-[#161512] px-4 py-2 text-sm font-medium hover:bg-[#e8e3d7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
        >
          Reload households
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6">
      <header className="border-b border-[#c9c3b6] pb-4">
        <h1 className="font-serif text-3xl">Annex C report generator</h1>
        <p className="mt-2 max-w-[75ch] text-sm leading-6 text-[#3f3b34]">
          Choose a household with a confirmed grantee, review its Annex C case study report, and
          download a Word document using the official template.
        </p>
      </header>

      <div className="mt-5 flex flex-wrap items-end gap-4 print:hidden">
        <div className="min-w-[260px] flex-1">
          <label htmlFor="report-household" className="block text-sm font-medium">
            Household
          </label>
          <select
            id="report-household"
            value={household.id}
            onChange={(event) => setSelectedId(event.target.value)}
            className="mt-1 min-h-[40px] w-full border border-[#161512] bg-[#f4f1ea] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
          >
            {households.map((item) => (
              <option key={item.id} value={item.id}>
                {`HH ${item.hhId} · ${item.grantee.name} · ${item.barangay || item.municipality}`}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="min-h-[40px] border border-[#161512] bg-[#161512] px-5 py-2 text-sm font-medium text-[#f4f1ea] hover:bg-[#7a1f1f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloading ? "Preparing Word document…" : "Download Word document"}
        </button>
      </div>

      <div className="mt-3 space-y-1 text-sm text-[#3f3b34] print:hidden" role="status">
        {householdRefreshNotice ? <p>{householdRefreshNotice}</p> : null}
        {carsRefreshNotice ? <p>{carsRefreshNotice}</p> : null}
        {downloaded ? (
          <p>
            Annex C downloaded for {draft.granteeName} ({draft.hhId}).
          </p>
        ) : null}
        {downloadError ? (
          <p role="alert" className="border-l-4 border-[#7a1f1f] bg-[#f2e4e1] px-3 py-2 text-[#7a1f1f]">
            {downloadError}
          </p>
        ) : null}
        <p>
          Report based on:{" "}
          {ownedCars.find((car) => car.householdId === household.id)
            ? `saved CAR ${draft.reference}`
            : "preview created from imported household information"}
          {" · "}template {draft.templateVersion}{" · "}
          {missing.length === 0
            ? "all required report fields present"
            : `${missing.length} required field${missing.length === 1 ? "" : "s"} still blank`}
        </p>
        {carsNote ? <p>{carsNote}</p> : null}
      </div>

      {missing.length > 0 ? (
        <details className="mt-3 max-w-[70ch] border-l-4 border-[#7a1f1f] bg-[#f2e4e1] px-4 py-3 text-sm print:hidden">
          <summary className="cursor-pointer font-medium text-[#7a1f1f]">
            Missing ({missing.length})
          </summary>
          <ul className="mt-2 list-inside list-disc space-y-1 text-[#3f3b34]">
            {missing.map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-6 min-w-0" data-testid="annex-c-preview">
        <CarReportDocument
          draft={draft}
          household={household}
          mode="preview"
          onSlotEdit={() => undefined}
          onUpdateFamilyMember={() => undefined}
          onUpdateIntervention={() => undefined}
          onAddIntervention={() => undefined}
          onRemoveIntervention={() => undefined}
        />
      </div>
    </div>
  );
}
