import { IconButton } from "../../common/components/ui";

export default function AppMainFrame({
  children,
  isMobileLayout,
  isSidebarOpen,
  onToggleSidebarOpen,
  MenuIcon,
}) {
  return (
    <main className="main">
      {isMobileLayout ? (
        <div className="mobile-main-actions">
          <IconButton
            className="menu-toggle icon-only"
            onClick={() => onToggleSidebarOpen((current) => !current)}
            ariaLabel="Toggle navigation menu"
            aria-expanded={isSidebarOpen}
            aria-controls="app-sidebar"
          >
            <MenuIcon />
          </IconButton>
        </div>
      ) : null}
      {children}
    </main>
  );
}
