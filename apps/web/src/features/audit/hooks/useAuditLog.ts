import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fetchAuditEvents } from "../api";
import type { AuditEntityType, AuditEvent, AuditFilters } from "../types";
import { serverDataCache } from "../../../shared/server-data-cache";

const AUDIT_STALE_TIME = 30_000;

type CachedAuditResults = {
  events: AuditEvent[];
  total: number;
};

const initialFilters: AuditFilters = {
  search: "",
  actor: "",
  entityType: "all",
  dateFrom: "",
  dateTo: "",
};

export function useAuditLog(enabled = true, userId = "") {
  const [filters, setFilters] = useState(initialFilters);
  const initialCacheKey = `audit:${userId}:${JSON.stringify(initialFilters)}`;
  const [events, setEvents] = useState<AuditEvent[]>(
    () => serverDataCache.get<CachedAuditResults>(initialCacheKey)?.data.events ?? [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    () => serverDataCache.get<CachedAuditResults>(initialCacheKey)?.data.events[0]?.id ?? null,
  );
  const [total, setTotal] = useState(
    () => serverDataCache.get<CachedAuditResults>(initialCacheKey)?.data.total ?? 0,
  );
  const [offset, setOffset] = useState(0);
  const [dataOwnerId, setDataOwnerId] = useState(userId);
  const [loading, setLoading] = useState(
    () => enabled && !serverDataCache.get<CachedAuditResults>(initialCacheKey),
  );
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);
  const forceRefreshRef = useRef(false);

  useLayoutEffect(() => {
    if (dataOwnerId === userId) return;
    const key = `audit:${userId}:${JSON.stringify(initialFilters)}`;
    const cached = serverDataCache.get<CachedAuditResults>(key);
    setDataOwnerId(userId);
    setFilters(initialFilters);
    setEvents(cached?.data.events ?? []);
    setSelectedId(cached?.data.events[0]?.id ?? null);
    setTotal(cached?.data.total ?? 0);
    setOffset(0);
    setLoading(enabled && !cached);
    setError(null);
  }, [dataOwnerId, enabled, userId]);

  useEffect(() => {
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      setLoading(false);
      setError(null);
      return;
    }

    if (!enabled) {
      setLoading(false);
      setEvents([]);
      setTotal(0);
      setError(null);
      return;
    }

    const cacheKey = `audit:${userId}:${JSON.stringify(filters)}`;
    const cached = serverDataCache.get<CachedAuditResults>(cacheKey);
    if (cached) {
      setEvents(cached.data.events);
      setTotal(cached.data.total);
      setSelectedId((current) =>
        current && cached.data.events.some((event) => event.id === current)
          ? current
          : cached.data.events[0]?.id ?? null,
      );
    }

    const cachedPageAlreadyLoaded = Boolean(cached && cached.data.events.length > offset);
    const cacheIsFresh = Boolean(cached && serverDataCache.isFresh(cached, AUDIT_STALE_TIME));
    const forceRefresh = forceRefreshRef.current;
    forceRefreshRef.current = false;
    if (
      !forceRefresh &&
      cacheIsFresh &&
      (offset === 0 || cachedPageAlreadyLoaded)
    ) {
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    if (!cached || (offset > 0 && !cachedPageAlreadyLoaded)) setLoading(true);
    setError(null);

    fetchAuditEvents(filters, offset, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        const latestCache = serverDataCache.get<CachedAuditResults>(cacheKey);
        const baseEvents = latestCache?.data.events ?? [];
        const existingIds = new Set(baseEvents.map((event) => event.id));
        const mergedEvents =
          offset === 0
            ? page.events
            : [...baseEvents, ...page.events.filter((event) => !existingIds.has(event.id))];
        const result = { events: mergedEvents, total: page.total };
        serverDataCache.set(cacheKey, result);
        setEvents(result.events);
        setTotal(page.total);
        setSelectedId((current) =>
          result.events.some((event) => event.id === current)
            ? current
            : offset === 0
              ? result.events[0]?.id ?? null
              : current,
        );
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError("Audit records could not be loaded. Check your internet connection and try again.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [enabled, filters, offset, requestKey, userId]);

  const ownedEvents = dataOwnerId === userId ? events : [];
  const ownedTotal = dataOwnerId === userId ? total : 0;
  const selectedEvent = useMemo(
    () => ownedEvents.find((event) => event.id === selectedId) ?? ownedEvents[0] ?? null,
    [ownedEvents, selectedId],
  );

  const updateFilter = useCallback(
    <Key extends keyof AuditFilters>(key: Key, value: AuditFilters[Key]) => {
      setEvents([]);
      setSelectedId(null);
      setTotal(0);
      setOffset(0);
      setFilters((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const setEntityType = useCallback(
    (value: AuditEntityType | "all") => updateFilter("entityType", value),
    [updateFilter],
  );

  const clearFilters = useCallback(() => {
    setEvents([]);
    setSelectedId(null);
    setTotal(0);
    setOffset(0);
    setFilters(initialFilters);
  }, []);

  return {
    filters,
    events: ownedEvents,
    total: ownedTotal,
    loading,
    error,
    hasMore: ownedEvents.length < ownedTotal,
    selectedEvent,
    setSelectedId,
    updateFilter,
    setEntityType,
    clearFilters,
    loadMore: () => setOffset(ownedEvents.length),
    retry: () => {
      forceRefreshRef.current = true;
      setRequestKey((current) => current + 1);
    },
  };
}
