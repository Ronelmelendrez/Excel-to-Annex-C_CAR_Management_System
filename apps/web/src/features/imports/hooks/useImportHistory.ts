import { useCallback, useEffect, useRef, useState } from "react";
import { listImports } from "../api";
import type { ImportRecord } from "../types";

export function useImportHistory(pageSize = 20) {
  const [items, setItems] = useState<ImportRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (offset: number, append: boolean) => {
      const current = ++requestId.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const response = await listImports({ limit: pageSize, offset });
        if (current !== requestId.current) return;
        setTotal(response.total);
        setItems((existing) => (append ? [...existing, ...response.imports] : response.imports));
      } catch (e: any) {
        if (current !== requestId.current) return;
        setError(e?.message || "Import history could not be loaded.");
      } finally {
        if (current === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [pageSize],
  );

  useEffect(() => {
    void load(0, false);
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  const refresh = useCallback(() => load(0, false), [load]);
  const loadMore = useCallback(() => load(items.length, true), [items.length, load]);

  return { items, total, loading, loadingMore, error, refresh, loadMore, hasMore: items.length < total };
}
