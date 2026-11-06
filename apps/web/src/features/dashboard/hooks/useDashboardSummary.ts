import { useCallback, useEffect, useState } from "react";
import { fetchDashboardSummary } from "../api";
import type { DashboardScope } from "../types";

export function useDashboardSummary(scope: DashboardScope) {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchDashboardSummary>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let refreshing = false;
    setSummary((current) => (current?.scope === scope ? current : null));
    setLoading(true);
    setError(null);

    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        const result = await fetchDashboardSummary(scope);
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

    void refresh();
    const interval = window.setInterval(() => void refresh(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [scope, reloadToken]);

  const visibleSummary = summary?.scope === scope ? summary : null;

  const reload = useCallback(() => {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

  return { summary: visibleSummary, loading, error, reload };
}
