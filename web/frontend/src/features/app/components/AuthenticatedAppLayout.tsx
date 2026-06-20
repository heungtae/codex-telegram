import AuthenticatedAppPresenter from "./AuthenticatedAppPresenter";
import AppMainFrame from "./AppMainFrame";
import AppMainPresenter from "./AppMainPresenter";
import AppSidebarPresenter from "./AppSidebarPresenter";
import { PanelRightIcon } from "../../common/components/Icons";

export default function AuthenticatedAppLayout({
  isMobileLayout,
  overlays,
  sidebar,
  main,
  isSidebarOpen,
  onToggleSidebarOpen,
  MenuIcon,
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
    <AuthenticatedAppPresenter>
      <div className={appClass}>
        {overlays}
        <AppSidebarPresenter>{sidebar}</AppSidebarPresenter>
        <AppMainPresenter>
          <AppMainFrame
            isMobileLayout={isMobileLayout}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebarOpen={onToggleSidebarOpen}
            MenuIcon={MenuIcon}
          >
            {main}
          </AppMainFrame>
        </AppMainPresenter>
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
                <button
                  className="workspace-panel-rail-toggle"
                  type="button"
                  onClick={onToggleWorkspacePanel}
                  aria-label="Open workspace panel"
                  title="Open workspace panel"
                >
                  <PanelRightIcon />
                </button>
              )}
            </div>
          </>
        ) : null}
      </div>
    </AuthenticatedAppPresenter>
  );
}
