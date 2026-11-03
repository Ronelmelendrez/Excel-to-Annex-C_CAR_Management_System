import { ApiError, apiCall } from "../../shared/api";
import { isDemoMode } from "../../shared/supabase";
import { mockHouseholds } from "./mock-data";
import type { HouseholdRecord } from "./mock-data";

export type HouseholdListResponse = {
  households: HouseholdRecord[];
  total: number;
};

/** Keeps the register usable even if the server response shape drifts. */
function asHousehold(raw: unknown): HouseholdRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.hhId !== "string") return null;

  const members = (Array.isArray(row.members) ? row.members : [])
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const member = entry as Record<string, unknown>;
      if (typeof member.id !== "string") return null;
      const raw = Array.isArray(member.raw)
        ? member.raw.map((cell) => (cell == null ? null : String(cell)))
        : undefined;
      return {
        id: member.id,
        entryId: typeof member.entryId === "string" ? member.entryId : "",
        name: typeof member.name === "string" ? member.name : "",
        relationship: typeof member.relationship === "string" ? member.relationship : "",
        age: typeof member.age === "number" && Number.isFinite(member.age) ? member.age : null,
        granteeFlag: typeof member.granteeFlag === "string" ? member.granteeFlag : "",
        sourceRow: Number.isFinite(Number(member.sourceRow)) ? Number(member.sourceRow) : 0,
        ...(raw && raw.length ? { raw } : {}),
      };
    })
    .filter((member): member is NonNullable<typeof member> => member !== null);

  const headers = Array.isArray(row.headers)
    ? row.headers.map((header) => String(header))
    : undefined;

  const car =
    row.car && typeof row.car === "object"
      ? (() => {
          const car = row.car as Record<string, unknown>;
          if (typeof car.reference !== "string") return null;
          return { reference: car.reference, status: typeof car.status === "string" ? car.status : "" };
        })()
      : null;

  return {
    id: row.id,
    hhId: row.hhId,
    barangay: typeof row.barangay === "string" ? row.barangay : "",
    municipality: typeof row.municipality === "string" ? row.municipality : "",
    importName: typeof row.importName === "string" ? row.importName : "",
    importVersion: Number.isFinite(Number(row.importVersion)) ? Number(row.importVersion) : 1,
    ...(headers && headers.length ? { headers } : {}),
    members,
    car,
  };
}

/**
 * Loads the household register. Demo mode serves the local sample with no
 * network call; real mode reads committed imports through the households
 * edge function.
 */
export async function listHouseholds(): Promise<HouseholdListResponse> {
  if (isDemoMode) {
    return { households: mockHouseholds, total: mockHouseholds.length };
  }
  const data = (await apiCall("/households?action=list")) as {
    households?: unknown[];
    total?: number;
  };
  const households = (Array.isArray(data?.households) ? data.households : [])
    .map(asHousehold)
    .filter((household): household is HouseholdRecord => household !== null);
  return {
    households,
    total: Number.isFinite(Number(data?.total)) ? Number(data.total) : households.length,
  };
}

/** Friendly copy for load failures instead of raw server codes. */
export function householdListError(error: unknown): string {
  const code = error instanceof ApiError ? error.code : "";
  if (code === "UNAUTHORIZED" || code === "unauthorized") {
    return "Your session has expired. Sign in again to view the household register.";
  }
  if (code === "forbidden") {
    return "You do not have access to household records.";
  }
  return "The household register could not be loaded. Check your connection and try again.";
}
