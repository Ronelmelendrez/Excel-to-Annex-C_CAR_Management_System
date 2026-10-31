import React from "react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ImportWizard } from "../hooks/useImportWizard";
import type { StoredImportSession } from "../lib/import-store";

const { useImportWizardMock } = vi.hoisted(() => ({ useImportWizardMock: vi.fn() }));

vi.mock("../../../app/providers", () => ({
  useAuth: () => ({ user: { id: "operator-1" }, roles: ["operator"] }),
}));
vi.mock("../hooks/useImportWizard", () => ({ useImportWizard: useImportWizardMock }));
vi.mock("../hooks/useImportHistory", () => ({
  useImportHistory: () => ({
    items: [],
    total: 0,
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
    refresh: vi.fn(),
    loadMore: vi.fn(),
  }),
}));
vi.mock("../components/ImportWizard", () => ({ ImportWizard: () => <div>Import wizard</div> }));
vi.mock("../components/ImportHistory", () => ({ ImportHistory: () => <div>Import history</div> }));

import { ImportsPage } from "../components/ImportsPage";

const session: StoredImportSession = {
  schema: 1,
  id: "session-1",
  userId: "operator-1",
  createdAt: Date.parse("2026-10-30T08:00:00.000Z"),
  updatedAt: Date.parse("2026-10-30T08:15:00.000Z"),
  fileName: "Annex C - October.xlsx",
  fileSize: 1024,
  fileHash: null,
  checkpoint: "shaped",
  status: "paused",
  sheetNames: ["Households"],
  sheetName: "Households",
  headerRow: 0,
  headers: ["HH_ID", "ENTRY_ID"],
  mapping: null,
  rowCount: 250,
  dataRowCount: 250,
  batchSize: 20_000,
  lastCompletedBatchIndex: -1,
  failedBatchIndex: null,
  batchResults: [],
  storagePath: null,
  preview: null,
  result: null,
  lastError: null,
};

function makeWizard(overrides: Partial<ImportWizard> = {}): ImportWizard {
  return {
    stage: "choose",
    bundle: null,
    sheet: null,
    preview: null,
    result: null,
    busy: null,
    batchProgress: null,
    readStage: null,
    error: null,
    duplicateConfirmed: false,
    coverage: { missing: [], mappedCount: 0, totalCount: 0 },
    chooseFile: vi.fn(async () => {}),
    selectSheet: vi.fn(),
    setHeaderRow: vi.fn(),
    setMappingField: vi.fn(),
    processRows: vi.fn(async () => {}),
    pauseProcessing: vi.fn(async () => {}),
    validate: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    setDuplicateConfirmed: vi.fn(),
    cancelRead: vi.fn(),
    backToShape: vi.fn(),
    reset: vi.fn(),
    sessions: [],
    sessionsLoading: false,
    sessionsError: false,
    activeSessionId: null,
    storeNotice: null,
    dismissStoreNotice: vi.fn(),
    resumeSession: vi.fn(async () => {}),
    pauseSession: vi.fn(async () => {}),
    cancelSession: vi.fn(async () => {}),
    removeSession: vi.fn(async () => {}),
    clearFinishedSessions: vi.fn(async () => {}),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useImportWizardMock.mockReturnValue(makeWizard());
});

describe("import recovery session controls", () => {
  it("shows loading and empty states", () => {
    useImportWizardMock.mockReturnValueOnce(makeWizard({ sessionsLoading: true }));
    const { rerender } = render(<ImportsPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading saved import sessions");

    useImportWizardMock.mockReturnValueOnce(makeWizard());
    rerender(<ImportsPage />);
    expect(screen.getByText("No saved import sessions on this device.")).toBeInTheDocument();
  });

  it("shows session metadata and wires Resume, Cancel, and Delete actions", async () => {
    const wizard = makeWizard({ sessions: [session] });
    useImportWizardMock.mockReturnValue(wizard);
    render(<ImportsPage />);

    expect(screen.getByText(session.fileName)).toBeInTheDocument();
    expect(screen.getByText("Sheet and columns selected")).toBeInTheDocument();
    expect(screen.getByText(/250 source rows/)).toBeInTheDocument();
    expect(screen.getByText(/Oct 30, 2026/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    await waitFor(() => expect(wizard.resumeSession).toHaveBeenCalledWith(session.id));

    fireEvent.click(screen.getByRole("button", { name: "Cancel import" }));
    await waitFor(() => expect(wizard.cancelSession).toHaveBeenCalledWith(session.id));

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(wizard.removeSession).toHaveBeenCalledWith(session.id));
  });

  it("does not offer Resume or Cancel for completed imports", () => {
    useImportWizardMock.mockReturnValue(
      makeWizard({
        sessions: [{ ...session, status: "completed", checkpoint: "committed" }],
      }),
    );
    render(<ImportsPage />);

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel import" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("offers clearing only when completed or expired sessions exist", async () => {
    const clearFinishedSessions = vi.fn(async () => {});
    useImportWizardMock.mockReturnValue(
      makeWizard({
        sessions: [session, { ...session, id: "completed", status: "completed", checkpoint: "committed" }],
        clearFinishedSessions,
      }),
    );
    render(<ImportsPage />);

    const clearButton = screen.getByRole("button", { name: "Clear completed or expired" });
    expect(clearButton).toBeEnabled();
    fireEvent.click(clearButton);
    await waitFor(() => expect(clearFinishedSessions).toHaveBeenCalledOnce());
  });

  it("shows recovery-storage errors", () => {
    useImportWizardMock.mockReturnValue(
      makeWizard({
        sessionsError: true,
        storeNotice: { title: "Local recovery is unavailable", detail: "Storage is blocked." },
      }),
    );
    render(<ImportsPage />);
    expect(screen.getByText("Local recovery is unavailable")).toBeInTheDocument();
    expect(screen.getByText("Storage is blocked.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Saved sessions could not be loaded");
  });
});
