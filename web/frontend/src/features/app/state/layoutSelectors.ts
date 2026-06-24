export function getWorkspacePanelStyle(isCompactWorkspaceLayout, workspacePanelWidth, isWorkspaceExpanded = false) {
  if (isCompactWorkspaceLayout || isWorkspaceExpanded) return undefined;
  return { width: workspacePanelWidth };
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

