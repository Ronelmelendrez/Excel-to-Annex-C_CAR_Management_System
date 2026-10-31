import React, { useState } from "react";
import { useAuth } from "../../../app/providers";
import { useImportWizard } from "../hooks/useImportWizard";
import { useImportHistory } from "../hooks/useImportHistory";
import { ImportWizard } from "./ImportWizard";
import { ImportHistory } from "./ImportHistory";
import { formatDateTime } from "../lib/analysis";
import { isClearable, isResumable, type StoredImportSession } from "../lib/import-store";
import { Notice, primaryButton, quietButton, secondaryButton } from "./primitives";

const CHECKPOINT_LABELS: Record<StoredImportSession["checkpoint"], string> = {
  file_saved: "Workbook saved",
  parsed: "Workbook parsed",
  shaped: "Sheet and columns selected",
  processing: "Processing batches",
  processed: "Rows processed",
  uploaded: "Workbook uploaded",
  validated: "Validation saved",
  committing: "Commit in progress",
  committed: "Import complete",
};

function RecoverySessions({ wizard }: { wizard: ReturnType<typeof useImportWizard> }) {
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const runAction = async (id: string, action: () => Promise<void>) => {
    setActionId(id);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The local import session could not be updated.");
    } finally {
      setActionId(null);
    }
  };

  const clearableSessions = wizard.sessions.filter(
    (session) => session.id !== wizard.activeSessionId && isClearable(session),
  );

  return (
    <section
      aria-labelledby="recovery-heading"
      className="mt-8 border border-[#8c877c] bg-[#f8f5ee] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#c9c3b6] pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e]">
            This browser only
          </p>
          <h2 id="recovery-heading" className="mt-2 font-serif text-2xl">
            Saved import sessions
          </h2>
          <p className="mt-2 max-w-[68ch] text-sm leading-6 text-[#5b574e]">
            These temporary recovery copies stay on this device. Final validated records remain in
            the CAR register.
          </p>
        </div>
        <button
          type="button"
          className={secondaryButton}
          disabled={clearableSessions.length === 0 || actionId !== null}
          onClick={() => void runAction("clear", wizard.clearFinishedSessions)}
        >
          Clear completed or expired
        </button>
      </div>

      {wizard.storeNotice && (
        <div className="mt-4">
          <Notice
            tone="warning"
            title={wizard.storeNotice.title}
            actions={
              <button type="button" className={quietButton} onClick={wizard.dismissStoreNotice}>
                Dismiss
              </button>
            }
          >
            {wizard.storeNotice.detail}
          </Notice>
        </div>
      )}
      {actionError && (
        <div className="mt-4">
          <Notice tone="error" title="Saved session action failed">
            {actionError}
          </Notice>
        </div>
      )}

      {wizard.sessionsLoading ? (
        <p role="status" className="mt-4 text-sm text-[#5b574e]">
          Loading saved import sessions…
        </p>
      ) : wizard.sessionsError ? (
        <p role="alert" className="mt-4 text-sm text-[#7a1f1f]">
          Saved sessions could not be loaded. Resolve the recovery-storage message above and try again.
        </p>
      ) : wizard.sessions.length === 0 ? (
        <p className="mt-4 text-sm text-[#5b574e]">No saved import sessions on this device.</p>
      ) : (
        <ul className="divide-y divide-[#c9c3b6]">
          {wizard.sessions.map((session) => {
            const resumable = isResumable(session);
            const isActive = session.id === wizard.activeSessionId;
            const processing = wizard.busy !== null;
            return (
              <li key={session.id} className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <h3 className="break-all text-sm font-semibold">{session.fileName}</h3>
                  <dl className="mt-2 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <dt className="font-semibold text-[#5b574e]">Status</dt>
                      <dd className="mt-1 capitalize">
                        {session.status === "cancelled"
                          ? "Cancelled"
                          : resumable
                            ? session.status.replace("_", " ")
                            : "Completed"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[#5b574e]">Progress</dt>
                      <dd className="mt-1" aria-live="polite">
                        {CHECKPOINT_LABELS[session.checkpoint]}
                        {session.rowCount !== null
                          ? ` · ${session.rowCount.toLocaleString()} source rows`
                          : ""}
                        {Math.ceil((session.dataRowCount ?? 0) / session.batchSize) > 0
                          ? ` · ${Math.max(0, session.lastCompletedBatchIndex + 1).toLocaleString()}/${Math.ceil((session.dataRowCount ?? 0) / session.batchSize).toLocaleString()} batches`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[#5b574e]">Last saved checkpoint</dt>
                      <dd className="mt-1">{CHECKPOINT_LABELS[session.checkpoint]}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[#5b574e]">Created</dt>
                      <dd className="mt-1">{formatDateTime(new Date(session.createdAt).toISOString())}</dd>
                    </div>
                  </dl>
                </div>
                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  {resumable && (
                    <button
                      type="button"
                      className={primaryButton}
                      disabled={processing || actionId !== null}
                      onClick={() => void runAction(session.id, () => wizard.resumeSession(session.id))}
                    >
                      {actionId === session.id && wizard.busy === "reading" ? "Resuming…" : "Resume"}
                    </button>
                  )}
                  {resumable && isActive && session.status === "in_progress" && (
                    <button
                      type="button"
                      className={secondaryButton}
                      disabled={(processing && wizard.busy !== "processing") || actionId !== null}
                      onClick={() => void runAction(session.id, () => wizard.pauseSession(session.id))}
                    >
                      Pause
                    </button>
                  )}
                  {resumable && (
                    <button
                      type="button"
                      className={quietButton}
                      disabled={(processing && wizard.busy !== "processing") || actionId !== null}
                      onClick={() => void runAction(session.id, () => wizard.cancelSession(session.id))}
                    >
                      Cancel import
                    </button>
                  )}
                  <button
                    type="button"
                    className={quietButton}
                    disabled={processing || actionId !== null || (isActive && session.status === "in_progress")}
                    onClick={() => void runAction(session.id, () => wizard.removeSession(session.id))}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function ImportsPage() {
  const { user, roles } = useAuth();
  const history = useImportHistory();
  const wizard = useImportWizard({
    userId: user?.id ?? null,
    onCommitted: () => {
      void history.refresh();
    },
  });

  const canImport = roles.includes("admin") || roles.includes("operator");

  if (!canImport) {
    return (
      <div className="max-w-[680px] border-l-4 border-[#7a1f1f] border-y border-r border-[#7a1f1f] bg-[#f2e4e1] px-4 py-4">
        <p className="text-sm font-semibold">Excel import is restricted</p>
        <p className="mt-1 text-sm leading-6 text-[#3f3b34]">
          Only operators and administrators can import workbooks. If you believe this is wrong, ask an
          administrator to review your account role.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ImportWizard wizard={wizard} />
      <RecoverySessions wizard={wizard} />
      <ImportHistory
        items={history.items}
        total={history.total}
        loading={history.loading}
        loadingMore={history.loadingMore}
        error={history.error}
        hasMore={history.hasMore}
        onRefresh={history.refresh}
        onLoadMore={history.loadMore}
      />
    </div>
  );
}
