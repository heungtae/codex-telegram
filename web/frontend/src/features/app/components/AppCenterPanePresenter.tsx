export default function AppCenterPanePresenter({
  topTabs,
  centerPane,
  isCompactWorkspaceLayout,
  isWorkspacePanelOpen,
  workspacePanel,
  isResizingWorkspacePanel,
  onStartWorkspacePanelResize,
}) {
  return (
    <>
      {topTabs}
      <div className="workspace-layout">
        <div className="center-pane">
          {centerPane}
          {isCompactWorkspaceLayout && isWorkspacePanelOpen ? workspacePanel : null}
        </div>
        {!isCompactWorkspaceLayout ? (
          <div className="workspace-panel-shell">
            <div
              className={`workspace-panel-resizer ${isResizingWorkspacePanel ? "active" : ""}`}
              onMouseDown={onStartWorkspacePanelResize}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize workspace files panel"
            />
            {workspacePanel}
          </div>
        ) : null}
      </div>
    </>
  );
}
