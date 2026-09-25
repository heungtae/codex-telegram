import { MenuIcon, PanelRightIcon } from "../../common/components/Icons";
import { IconButton } from "../../common/components/ui";

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
        <main className="main">
          {isMobileLayout ? (
            <div className="mobile-main-actions">
              <IconButton
                className="menu-toggle icon-only"
                onClick={() => onToggleSidebarOpen((current) => !current)}
                aria-label="Toggle navigation menu"
                aria-expanded={isSidebarOpen}
                aria-controls="app-sidebar"
              >
                <MenuIcon />
              </IconButton>
            </div>
          ) : null}
          {main}
        </main>
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
