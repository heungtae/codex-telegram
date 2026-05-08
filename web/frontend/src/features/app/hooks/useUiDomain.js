import { useState } from "react";

export function clampDimension(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
  const [isWorkspacePanelOpen, setIsWorkspacePanelOpen] = useState(false);
  const [isProjectModeModalOpen, setIsProjectModeModalOpen] = useState(false);
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
  const [shortcutModalPage, setShortcutModalPage] = useState("main");
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [pendingProjectTarget, setPendingProjectTarget] = useState("");
  const [turnNotificationEnabled, setTurnNotificationEnabled] = useState(() => readTurnNotificationEnabled());
  const [toastNotification, setToastNotification] = useState(null);

  const actions = {
    setPaletteSelectedIndex,
    setSidebarWidth,
    setIsResizingSidebar,
    setIsSidebarCollapsed,
    setIsMobileLayout,
    setIsSidebarOpen,
    setIsCompactWorkspaceLayout,
    setIsWorkspacePanelOpen,
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
