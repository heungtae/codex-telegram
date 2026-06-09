import { RefreshIcon } from "../../common/components/Icons";

export default function WorkspacePanelHeader({
  workspaceRootLabel,
  refreshWorkspaceBrowser,
  setWorkspaceError,
}) {
  return (
    <div className="workspace-panel-head">
      <div>
        <div className="workspace-panel-title">Workspace Files</div>
        <div className="workspace-panel-subtitle">{workspaceRootLabel}</div>
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
