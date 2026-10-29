import type {
  DashboardActivity,
  DashboardCarStatusCount,
  DashboardExportJob,
  DashboardImportRecord,
} from "./types";

export const mockDashboardImports: DashboardImportRecord[] = [
  {
    id: "import-assigned-2026-10-08",
    scope: "assigned",
    status: "committed",
    committedAt: "2026-10-08T09:10:00.000Z",
    weekLabel: "Oct 5-11",
    processedRows: 258,
    householdsDetected: 79,
    granteeIssues: 5,
  },
  {
    id: "import-assigned-2026-10-18",
    scope: "assigned",
    status: "committed",
    committedAt: "2026-10-18T08:25:00.000Z",
    weekLabel: "Oct 12-18",
    processedRows: 360,
    householdsDetected: 112,
    granteeIssues: 7,
  },
  {
    id: "import-system-2026-10-24",
    scope: "system",
    status: "committed",
    committedAt: "2026-10-24T06:40:00.000Z",
    weekLabel: "Oct 19-25",
    processedRows: 418,
    householdsDetected: 130,
    granteeIssues: 9,
  },
  {
    id: "import-assigned-failed-2026-10-29",
    scope: "assigned",
    status: "failed",
    committedAt: null,
    weekLabel: null,
    processedRows: 0,
    householdsDetected: 0,
    granteeIssues: 0,
  },
];

export const mockDashboardCarStatusCounts: DashboardCarStatusCount[] = [
  { scope: "assigned", status: "draft", count: 3 },
  { scope: "assigned", status: "submitted", count: 2 },
  { scope: "assigned", status: "changes_requested", count: 1 },
  { scope: "assigned", status: "approved", count: 5 },
  { scope: "system", status: "draft", count: 1 },
  { scope: "system", status: "submitted", count: 2 },
  { scope: "system", status: "changes_requested", count: 1 },
  { scope: "system", status: "approved", count: 3 },
];

export const mockDashboardExportJobs: DashboardExportJob[] = [
  {
    id: "export-assigned-failed-2026-10-28",
    scope: "assigned",
    status: "failed",
    occurredAt: "2026-10-28T11:10:00.000Z",
  },
  {
    id: "export-system-failed-2026-10-22",
    scope: "system",
    status: "failed",
    occurredAt: "2026-10-22T13:45:00.000Z",
  },
  {
    id: "export-assigned-verified-2026-10-25",
    scope: "assigned",
    status: "verified",
    occurredAt: "2026-10-25T10:20:00.000Z",
  },
];

export const mockDashboardActivity: DashboardActivity[] = [
  {
    id: "activity-import-committed",
    scope: "assigned",
    occurredAt: "2026-10-28T09:10:00.000Z",
    label: "Workbook import committed",
    destination: "/imports",
  },
  {
    id: "activity-export-failed",
    scope: "assigned",
    occurredAt: "2026-10-28T11:10:00.000Z",
    label: "PDF export needs attention",
    destination: "/documents",
  },
  {
    id: "activity-car-submitted",
    scope: "assigned",
    occurredAt: "2026-10-27T14:35:00.000Z",
    label: "CAR submitted for review",
    destination: "/review",
  },
  {
    id: "activity-grantee-review",
    scope: "assigned",
    occurredAt: "2026-10-26T08:05:00.000Z",
    label: "Grantee review items updated",
    destination: "/households",
  },
  {
    id: "activity-system-import",
    scope: "system",
    occurredAt: "2026-10-24T06:40:00.000Z",
    label: "Workbook import committed",
    destination: "/imports",
  },
  {
    id: "activity-system-export-failed",
    scope: "system",
    occurredAt: "2026-10-22T13:45:00.000Z",
    label: "PDF export needs attention",
    destination: "/documents",
  },
];
