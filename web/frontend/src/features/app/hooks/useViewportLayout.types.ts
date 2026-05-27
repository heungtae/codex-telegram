export type UseViewportLayoutArgs = {
  mobileBreakpoint: number;
  workspacePanelBreakpoint: number;
  isMobileLayout: boolean;
  isSidebarOpen: boolean;
  isCompactWorkspaceLayout: boolean;
  setIsMobileLayout: (next: boolean) => void;
  setIsCompactWorkspaceLayout: (next: boolean) => void;
  setIsSidebarOpen: (next: boolean) => void;
  setIsResizingSidebar: (next: boolean) => void;
  setIsWorkspacePanelOpen: (next: boolean) => void;
  setIsResizingWorkspacePanel: (next: boolean) => void;
};
