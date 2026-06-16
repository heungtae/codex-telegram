import { useState } from "react";

const WORKSPACE_PANEL_OPEN_STORAGE_KEY = "codex-web-workspace-panel-open";

export function clampDimension(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function resolveInitialWorkspacePanelOpen(isCompactWorkspaceLayout, storedValue) {
  if (storedValue === "open") {
    return true;
  }
  if (storedValue === "closed") {
    return false;
  }
  return !isCompactWorkspaceLayout;
}

function readWorkspacePanelOpen(isCompactWorkspaceLayout) {
  if (typeof window === "undefined") {
    return resolveInitialWorkspacePanelOpen(isCompactWorkspaceLayout, null);
  }
  let storedValue = null;
  try {
    storedValue = window.localStorage.getItem(WORKSPACE_PANEL_OPEN_STORAGE_KEY);
  } catch {
    storedValue = null;
  }
  return resolveInitialWorkspacePanelOpen(isCompactWorkspaceLayout, storedValue);
}

function persistWorkspacePanelOpen(next) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(WORKSPACE_PANEL_OPEN_STORAGE_KEY, next ? "open" : "closed");
  } catch {
    // Ignore storage failures; the in-memory panel state still updates.
  }
}

export default function useUiDomain({
  mobileBreakpoint,
  workspacePanelBreakpoint,
  readTurnNotificationEnabled,
}) {
  const [paletteSelectedIndex, setPaletteSelectedIndex] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= mobileBreakpoint : false
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCompactWorkspaceLayout, setIsCompactWorkspaceLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= workspacePanelBreakpoint : false
  );
  const [isWorkspacePanelOpen, setWorkspacePanelOpenState] = useState(() =>
    readWorkspacePanelOpen(typeof window !== "undefined" ? window.innerWidth <= workspacePanelBreakpoint : false)
  );
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);
  const [isProjectModeModalOpen, setIsProjectModeModalOpen] = useState(false);
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
  const [shortcutModalPage, setShortcutModalPage] = useState("main");
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [pendingProjectTarget, setPendingProjectTarget] = useState("");
  const [turnNotificationEnabled, setTurnNotificationEnabled] = useState(() => readTurnNotificationEnabled());
  const [toastNotification, setToastNotification] = useState(null);

  const setIsWorkspacePanelOpen = (next) => {
    setWorkspacePanelOpenState((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      persistWorkspacePanelOpen(!!resolved);
      return !!resolved;
    });
  };

  const actions = {
    setPaletteSelectedIndex,
    setSidebarWidth,
    setIsResizingSidebar,
    setIsSidebarCollapsed,
    setIsMobileLayout,
    setIsSidebarOpen,
    setIsCompactWorkspaceLayout,
    setIsWorkspacePanelOpen,
    setIsWorkspaceExpanded,
    setIsProjectModeModalOpen,
    setIsShortcutModalOpen,
    setShortcutModalPage,
    setSelectedProjectIndex,
    setProjectSearchQuery,
    setPendingProjectTarget,
    setTurnNotificationEnabled,
    setToastNotification,
  };

  return {
    paletteSelectedIndex,
    sidebarWidth,
    isResizingSidebar,
    isSidebarCollapsed,
    isMobileLayout,
    isSidebarOpen,
    isCompactWorkspaceLayout,
    isWorkspacePanelOpen,
    isWorkspaceExpanded,
    isProjectModeModalOpen,
    isShortcutModalOpen,
    shortcutModalPage,
    selectedProjectIndex,
    projectSearchQuery,
    pendingProjectTarget,
    turnNotificationEnabled,
    toastNotification,
    ...actions,
    actions,
  };
}
