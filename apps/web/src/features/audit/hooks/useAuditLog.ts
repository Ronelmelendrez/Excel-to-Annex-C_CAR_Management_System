import { useCallback, useEffect, useMemo, useState } from "react";
import { AUDIT_PAGE_SIZE, fetchAuditEvents } from "../api";
import type { AuditEntityType, AuditEvent, AuditFilters } from "../types";

const initialFilters: AuditFilters = {
  search: "",
  actor: "",
  entityType: "all",
  dateFrom: "",
  dateTo: "",
};

export function useAuditLog(enabled = true) {
  const [filters, setFilters] = useState(initialFilters);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);

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

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchAuditEvents(filters, offset, controller.signal)
      .then((page) => {
        setEvents((current) =>
          offset === 0 ? page.events : [...current, ...page.events],
        );
        setTotal(page.total);
        setSelectedId((current) =>
          page.events.some((event) => event.id === current)
            ? current
            : offset === 0
              ? page.events[0]?.id ?? null
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
  }, [enabled, filters, offset, requestKey]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedId) ?? events[0] ?? null,
    [events, selectedId],
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
    events,
    total,
    loading,
    error,
    hasMore: events.length < total,
    selectedEvent,
    setSelectedId,
    updateFilter,
    setEntityType,
    clearFilters,
    loadMore: () => setOffset((current) => current + AUDIT_PAGE_SIZE),
    retry: () => setRequestKey((current) => current + 1),
  };
}
