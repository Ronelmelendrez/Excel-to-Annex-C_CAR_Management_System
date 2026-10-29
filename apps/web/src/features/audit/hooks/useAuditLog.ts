import { useMemo, useState } from "react";
import { mockAuditEvents } from "../mock-data";
import { filterAuditEvents } from "../lib/audit";
import type { AuditEntityType, AuditFilters } from "../types";

const initialFilters: AuditFilters = {
  search: "",
  actor: "all",
  entityType: "all",
  dateFrom: "",
  dateTo: "",
};

export function useAuditLog() {
  const [filters, setFilters] = useState(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(mockAuditEvents[0]?.id ?? null);
  const events = useMemo(() => filterAuditEvents(mockAuditEvents, filters), [filters]);
  const selectedEvent =
    events.find((event) => event.id === selectedId) ?? events[0] ?? null;

  function updateFilter<Key extends keyof AuditFilters>(key: Key, value: AuditFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function setEntityType(value: AuditEntityType | "all") {
    updateFilter("entityType", value);
  }

  function clearFilters() {
    setFilters(initialFilters);
  }

  return {
    filters,
    events,
    selectedEvent,
    setSelectedId,
    updateFilter,
    setEntityType,
    clearFilters,
  };
}
