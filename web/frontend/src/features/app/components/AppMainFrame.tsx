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
          <button
            className="menu-toggle icon-only"
            type="button"
            onClick={() => onToggleSidebarOpen((current) => !current)}
            aria-label="Toggle navigation menu"
            aria-expanded={isSidebarOpen}
            aria-controls="app-sidebar"
          >
            <MenuIcon />
          </button>
        </div>
      ) : null}
      {children}
    </main>
  );
}
