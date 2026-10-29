import { useMemo } from "react";
import { getDashboardSummary } from "../lib/dashboard";
import type { DashboardScope } from "../types";

export function useDashboardSummary(scope: DashboardScope) {
  return useMemo(() => getDashboardSummary(scope), [scope]);
}
