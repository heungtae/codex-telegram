import { useCallback, useEffect } from "react";
import type { UseResizeInteractionsArgs } from "./useResizeInteractions.types";

export default function useResizeInteractions(args: UseResizeInteractionsArgs) {
  const {
    sidebarMin,
    sidebarMax,
    workspacePanelMin,
    workspacePanelMax,
    workspacePreviewMinWidth,
    workspacePreviewMaxWidth,
    workspacePreviewMinHeight,
    workspacePreviewMaxHeight,
    workspacePreviewDefaultWidth,
    workspacePreviewDefaultHeight,
    isResizingSidebar,
    isResizingWorkspacePanel,
    isResizingWorkspacePreview,
    workspacePreview,
    isProjectModeModalOpen,
    shortcutModalPage,
    workspacePreviewWidth,
    workspacePreviewHeight,
    workspaceResizeRef,
    workspacePreviewResizeRef,
    setSidebarWidth,
    setIsResizingSidebar,
    setWorkspacePanelWidth,
    setIsResizingWorkspacePanel,
    setWorkspacePreviewWidth,
    setWorkspacePreviewHeight,
    setIsResizingWorkspacePreview,
    setWorkspacePreview,
    persistWorkspacePreviewWidth: persistWidth,
    persistWorkspacePreviewHeight: persistHeight,
    clearWorkspacePreviewSize: clearSize,
  } = args;

  useEffect(() => {
    if (!isResizingSidebar) {
      return;
    }
    const onMove = (event: MouseEvent) => {
      const next = Math.max(sidebarMin, Math.min(sidebarMax, event.clientX));
      setSidebarWidth(next);
    };
    const onUp = () => setIsResizingSidebar(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    if (!isResizingWorkspacePanel) {
      return;
    }
    const onMove = (event: MouseEvent) => {
      const delta = workspaceResizeRef.current.startX - event.clientX;
      const next = workspaceResizeRef.current.startWidth + delta;
      setWorkspacePanelWidth(Math.max(workspacePanelMin, Math.min(workspacePanelMax, next)));
    };
    const onUp = () => setIsResizingWorkspacePanel(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizingWorkspacePanel]);

  useEffect(() => {
    if (!isResizingWorkspacePreview || typeof window === "undefined") {
      return;
    }
    const onMove = (event: MouseEvent) => {
      const { mode, startX, startY, startWidth, startHeight } = workspacePreviewResizeRef.current;
      if (mode === "width" || mode === "both") {
        const widthDelta = event.clientX - startX;
        const nextWidth = startWidth + widthDelta;
        setWorkspacePreviewWidth(Math.max(workspacePreviewMinWidth, Math.min(workspacePreviewMaxWidth, nextWidth)));
      }
      if (mode === "height" || mode === "both") {
        const heightDelta = event.clientY - startY;
        const nextHeight = startHeight + heightDelta;
        setWorkspacePreviewHeight(Math.max(workspacePreviewMinHeight, Math.min(workspacePreviewMaxHeight, nextHeight)));
      }
    };
    const onUp = () => setIsResizingWorkspacePreview(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizingWorkspacePreview]);

  useEffect(() => {
    if (!workspacePreview || typeof window === "undefined" || isProjectModeModalOpen || shortcutModalPage === "project") {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setIsResizingWorkspacePreview(false);
      setWorkspacePreview(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [workspacePreview, isProjectModeModalOpen, shortcutModalPage, setWorkspacePreview]);

  useEffect(() => {
    if (!workspacePreview) {
      setIsResizingWorkspacePreview(false);
    }
  }, [workspacePreview]);

  useEffect(() => {
    if (Number.isFinite(workspacePreviewWidth)) {
      persistWidth(workspacePreviewWidth);
    }
  }, [workspacePreviewWidth]);

  useEffect(() => {
    if (Number.isFinite(workspacePreviewHeight)) {
      persistHeight(workspacePreviewHeight);
    }
  }, [workspacePreviewHeight]);

  const resetWorkspacePreviewSize = useCallback(() => {
    clearSize();
    setWorkspacePreviewWidth(workspacePreviewDefaultWidth);
    setWorkspacePreviewHeight(workspacePreviewDefaultHeight);
  }, []);

  return { resetWorkspacePreviewSize };
}
