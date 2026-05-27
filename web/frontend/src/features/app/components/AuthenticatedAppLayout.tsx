import AuthenticatedAppPresenter from "./AuthenticatedAppPresenter";
import AppMainFrame from "./AppMainFrame";
import AppMainPresenter from "./AppMainPresenter";
import AppSidebarPresenter from "./AppSidebarPresenter";

export default function AuthenticatedAppLayout({
  isMobileLayout,
  overlays,
  sidebar,
  main,
  isSidebarOpen,
  onToggleSidebarOpen,
  MenuIcon,
}) {
  return (
    <AuthenticatedAppPresenter>
      <div className={`app ${isMobileLayout ? "mobile-layout" : ""}`}>
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
      </div>
    </AuthenticatedAppPresenter>
  );
}
