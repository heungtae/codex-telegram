export function getWorkspacePanelStyle(isCompactWorkspaceLayout, workspacePanelWidth) {
  return isCompactWorkspaceLayout ? undefined : { width: workspacePanelWidth };
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

export function shouldShowWorkspacePanelDesktop(isCompactWorkspaceLayout) {
  return !isCompactWorkspaceLayout;
}
