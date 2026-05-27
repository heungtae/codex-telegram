export default function AppSidebarFrame({
  children,
  isMobileLayout,
  isSidebarOpen,
  isDesktopSidebarCollapsed,
  sidebarStyle,
  isResizingSidebar,
  onToggleSidebarOpen,
  onToggleSidebarCollapsed,
  onStartSidebarResize,
  SidebarChevronIcon,
}) {
  return (
    <>
      <aside
        id="app-sidebar"
        className={`sidebar ${isMobileLayout ? "mobile" : "desktop"} ${isSidebarOpen ? "open" : ""} ${isDesktopSidebarCollapsed ? "collapsed" : ""}`}
        style={sidebarStyle}
        aria-hidden={isMobileLayout ? !isSidebarOpen : undefined}
      >
        {!isDesktopSidebarCollapsed ? <div className="sidebar-content">{children}</div> : null}
        <div className="sidebar-footer">
          <button
            className="sidebar-collapse-btn"
            type="button"
            onClick={() => {
              if (isMobileLayout) {
                onToggleSidebarOpen(false);
                return;
              }
              onToggleSidebarCollapsed();
            }}
            aria-label={isMobileLayout ? "Collapse left panel" : isDesktopSidebarCollapsed ? "Expand left panel" : "Collapse left panel"}
            title={isMobileLayout ? "Collapse left panel" : isDesktopSidebarCollapsed ? "Expand left panel" : "Collapse left panel"}
          >
            <SidebarChevronIcon collapsed={isMobileLayout ? false : isDesktopSidebarCollapsed} />
          </button>
        </div>
      </aside>
      {isMobileLayout ? (
        <button
          className={`sidebar-backdrop ${isSidebarOpen ? "open" : ""}`}
          type="button"
          onClick={() => onToggleSidebarOpen(false)}
          aria-label="Close navigation menu"
        />
      ) : !isDesktopSidebarCollapsed ? (
        <div
          className={`sidebar-resizer ${isResizingSidebar ? "active" : ""}`}
          onMouseDown={onStartSidebarResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
        />
      ) : (
        <div className="sidebar-resizer sidebar-resizer-collapsed" aria-hidden="true" />
      )}
    </>
  );
}
