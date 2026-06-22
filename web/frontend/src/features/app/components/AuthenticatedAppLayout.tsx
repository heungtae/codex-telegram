import AppMainFrame from "./AppMainFrame";
import { PanelRightIcon } from "../../common/components/Icons";

export default function AuthenticatedAppLayout({
  isMobileLayout,
  overlays,
  sidebar,
  main,
  isSidebarOpen,
  onToggleSidebarOpen,
  rightPanel,
  isWorkspacePanelOpen,
  isCompactWorkspaceLayout,
  isWorkspaceExpanded,
  isResizingWorkspacePanel,
  onStartWorkspacePanelResize,
  onToggleWorkspacePanel,
}) {
  const appClass = [
    "app",
    isMobileLayout ? "mobile-layout" : "",
    isWorkspaceExpanded ? "workspace-expanded" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={appClass}>
        {overlays}
        {sidebar}
        <AppMainFrame
          isMobileLayout={isMobileLayout}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebarOpen={onToggleSidebarOpen}
        >
          {main}
        </AppMainFrame>
        {!isCompactWorkspaceLayout ? (
          <>
            {isWorkspacePanelOpen ? (
              <div
                className={`workspace-right-resizer${isResizingWorkspacePanel ? " active" : ""}`}
                onMouseDown={onStartWorkspacePanelResize}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize workspace files panel"
              />
            ) : null}
            <div
              className={`workspace-right-sidebar${isWorkspacePanelOpen ? " open" : " closed"}`}
            >
              {isWorkspacePanelOpen ? (
                rightPanel
              ) : (
                <div className="workspace-panel-closed-header">
                  <button
                    className="sidebar-toggle-btn workspace-panel-open-btn"
                    type="button"
                    onClick={onToggleWorkspacePanel}
                    aria-label="Open workspace panel"
                    title="Open workspace panel"
                  >
                    <PanelRightIcon />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : null}
    </div>
  );
}
