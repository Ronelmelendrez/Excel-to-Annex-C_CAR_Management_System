import React from "react";
import { useAuth } from "../../../app/providers";
import { useImportWizard } from "../hooks/useImportWizard";
import { useImportHistory } from "../hooks/useImportHistory";
import { ImportWizard } from "./ImportWizard";
import { ImportHistory } from "./ImportHistory";

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
