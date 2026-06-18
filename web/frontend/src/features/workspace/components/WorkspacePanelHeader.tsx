import React from "react";
import { RefreshIcon } from "../../common/components/Icons";

export default function WorkspacePanelHeader({
  workspaceRootLabel,
  workspaceLeaf,
  refreshWorkspaceBrowser,
  setWorkspaceError,
}) {
  return (
    <div className="workspace-panel-head">
      <div>
        <div className="workspace-panel-title">{workspaceLeaf || workspaceRootLabel}</div>
        <div className="workspace-panel-subtitle">Workspace</div>
      </div>
      <button
        className="workspace-refresh"
        type="button"
        onClick={() => {
          refreshWorkspaceBrowser().catch((err) => {
            setWorkspaceError(err.message || "Failed to refresh workspace tree.");
          });
        }}
        aria-label="Refresh workspace browser"
        title="Refresh workspace browser"
      >
        <RefreshIcon />
      </button>
    </div>
  );
}
