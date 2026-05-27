import { useEffect } from "react";
import type { UseViewportLayoutArgs } from "./useViewportLayout.types";

export default function useViewportLayout(args: UseViewportLayoutArgs) {
  const {
    mobileBreakpoint,
    workspacePanelBreakpoint,
    isMobileLayout,
    isSidebarOpen,
    isCompactWorkspaceLayout,
    setIsMobileLayout,
    setIsCompactWorkspaceLayout,
    setIsSidebarOpen,
    setIsResizingSidebar,
    setIsWorkspacePanelOpen,
    setIsResizingWorkspacePanel,
  } = args;

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const syncViewport = () => {
      setIsMobileLayout(window.innerWidth <= mobileBreakpoint);
      setIsCompactWorkspaceLayout(window.innerWidth <= workspacePanelBreakpoint);
    };
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    if (!isMobileLayout) {
      setIsSidebarOpen(false);
      return;
    }
    setIsResizingSidebar(false);
  }, [isMobileLayout]);

  useEffect(() => {
    if (!isCompactWorkspaceLayout) {
      setIsWorkspacePanelOpen(false);
      return;
    }
    setIsResizingWorkspacePanel(false);
  }, [isCompactWorkspaceLayout]);

  useEffect(() => {
    if (!isMobileLayout || typeof document === "undefined") {
      return undefined;
    }
    const { body } = document;
    if (!body) {
      return undefined;
    }
    const previousOverflow = body.style.overflow;
    if (isSidebarOpen) {
      body.style.overflow = "hidden";
    }
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [isMobileLayout, isSidebarOpen]);

  useEffect(() => {
    if (!isMobileLayout || !isSidebarOpen || typeof window === "undefined") {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobileLayout, isSidebarOpen]);
}
