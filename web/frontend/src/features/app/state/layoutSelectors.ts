export function getWorkspacePanelStyle(isCompactWorkspaceLayout, _workspacePanelWidth, isWorkspaceExpanded = false) {
  if (isCompactWorkspaceLayout || isWorkspaceExpanded) return undefined;
  return { width: "100%" };
}

export function getSidebarStyle({
  isMobileLayout,
  isDesktopSidebarCollapsed,
  sidebarWidth,
  collapsedWidth,
}) {
  if (isMobileLayout) {
    return undefined;
  }
  return { width: isDesktopSidebarCollapsed ? collapsedWidth : sidebarWidth };
}
