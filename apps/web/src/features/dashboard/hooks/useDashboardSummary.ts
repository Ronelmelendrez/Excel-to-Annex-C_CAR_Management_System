import { useCallback, useEffect, useState } from "react";
import { fetchDashboardSummary } from "../api";
import type { DashboardScope } from "../types";
import {
  dashboardSummaryCacheKey,
  serverDataCache,
} from "../../../shared/server-data-cache";

const DASHBOARD_STALE_TIME = 15_000;

export function useDashboardSummary(scope: DashboardScope, userId = "") {
  const cacheKey = dashboardSummaryCacheKey(userId, scope);
  const [summary, setSummary] = useState(
    () => serverDataCache.get<Awaited<ReturnType<typeof fetchDashboardSummary>>>(cacheKey)?.data ?? null,
  );
  const [loading, setLoading] = useState(
    () => !serverDataCache.get<Awaited<ReturnType<typeof fetchDashboardSummary>>>(cacheKey),
  );
  const [dataOwnerId, setDataOwnerId] = useState(userId);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let refreshing = false;
    const key = dashboardSummaryCacheKey(userId, scope);
    const cached = serverDataCache.get<Awaited<ReturnType<typeof fetchDashboardSummary>>>(key);
    setDataOwnerId(userId);
    setSummary(cached?.data ?? null);
    setLoading(!cached);
    setError(null);

    async function refresh(force = false) {
      if (refreshing) return;
      const current = serverDataCache.get<Awaited<ReturnType<typeof fetchDashboardSummary>>>(key);
      if (!force && current && serverDataCache.isFresh(current, DASHBOARD_STALE_TIME)) {
        setSummary(current.data);
        setLoading(false);
        return;
      }

      refreshing = true;
      if (!current) setLoading(true);
      try {
        const result = await serverDataCache.fetch(key, () => fetchDashboardSummary(scope));
        if (!cancelled) {
          setSummary(result);
          setError(null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Dashboard information could not be loaded. Check your internet connection and try again.");
          setLoading(false);
        }
      } finally {
        refreshing = false;
      }
    }

    void refresh(reloadToken > 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, DASHBOARD_STALE_TIME);
    const handleResume = () => void refresh();
    window.addEventListener("focus", handleResume);
    window.addEventListener("online", handleResume);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleResume);
      window.removeEventListener("online", handleResume);
    };
  }, [scope, userId, reloadToken]);

  const visibleSummary = dataOwnerId === userId && summary?.scope === scope ? summary : null;

  const reload = useCallback(() => {
    if (!serverDataCache.get<Awaited<ReturnType<typeof fetchDashboardSummary>>>(
      dashboardSummaryCacheKey(userId, scope),
    )) {
      setLoading(true);
    }
    setReloadToken((token) => token + 1);
  }, [scope, userId]);

  return { summary: visibleSummary, loading, error, reload };
}
