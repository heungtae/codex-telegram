import { useEffect } from "react";
import type { UseGlobalKeyboardShortcutsArgs } from "./useGlobalKeyboardShortcuts.types";

export default function useGlobalKeyboardShortcuts(args: UseGlobalKeyboardShortcutsArgs) {
  const {
    shortcutModalPage,
    interactionBusy,
    activeThread,
    activeProjectTabId,
    threadTabsByProjectTabId,
    collaborationMode,
    modeSwitchBusy,
    isCompactWorkspaceLayout,
    projectSearchQuery,
    filteredProjects,
    selectedProjectIndex,
    activeProjectKey,
    focusComposerRef,
    startThreadRef,
    closeThreadTabRef,
    viewThreadRef,
    sendMessageRef,
    selectProjectRef,
    setShortcutModalPage,
    setProjectSearchQuery,
    setSelectedProjectIndex,
    setIsWorkspacePanelOpen,
    setCollaborationMode,
    api,
    normalizeThreadId,
  } = args;

  useEffect(() => {
    if (shortcutModalPage === "project") {
      setSelectedProjectIndex(0);
    }
  }, [projectSearchQuery, shortcutModalPage]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const ctrlKey = isMac ? event.metaKey : event.ctrlKey;
      const altKey = event.altKey;
      if (event.key === "Escape") {
        if (shortcutModalPage === "project") {
          setShortcutModalPage("main");
          setProjectSearchQuery("");
        }
        return;
      }
      if (altKey && !ctrlKey) {
        const target = event.target as HTMLElement | null;
        const isInputFocused = !!(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable));
        if (isInputFocused) {
          return;
        }
        event.preventDefault();
        switch (event.key) {
          case "n":
          case "N":
            focusComposerRef.current?.();
            if (!interactionBusy) {
              startThreadRef.current?.({ replaceCurrentTab: true }).catch(() => {});
            }
            break;
          case "t":
          case "T":
            if (!interactionBusy && activeProjectKey) {
              startThreadRef.current?.().catch(() => {});
            }
            break;
          case "w":
          case "W":
            if (activeThread && activeProjectTabId) {
              closeThreadTabRef.current?.(activeProjectTabId, activeThread);
            }
            break;
          case "p":
          case "P":
            setShortcutModalPage("project");
            setSelectedProjectIndex(0);
            setProjectSearchQuery("");
            break;
          case "v":
          case "V":
            if (isCompactWorkspaceLayout) {
              setIsWorkspacePanelOpen((current) => !current);
            }
            break;
          case "[": {
            const threadTabs = threadTabsByProjectTabId[activeProjectTabId] || [];
            const currentIndex = threadTabs.findIndex((t) => normalizeThreadId(t.id) === normalizeThreadId(activeThread));
            if (currentIndex > 0) {
              viewThreadRef.current?.(String(threadTabs[currentIndex - 1].id));
            } else if (threadTabs.length > 0) {
              viewThreadRef.current?.(String(threadTabs[threadTabs.length - 1].id));
            }
            break;
          }
          case "]": {
            const threadTabs = threadTabsByProjectTabId[activeProjectTabId] || [];
            const currentIndex = threadTabs.findIndex((t) => normalizeThreadId(t.id) === normalizeThreadId(activeThread));
            if (currentIndex < threadTabs.length - 1 && currentIndex >= 0) {
              viewThreadRef.current?.(String(threadTabs[currentIndex + 1].id));
            } else if (threadTabs.length > 0) {
              viewThreadRef.current?.(String(threadTabs[0].id));
            }
            break;
          }
          case "1":
          case "2":
          case "3":
          case "4":
          case "5":
          case "6":
          case "7":
          case "8":
          case "9": {
            const num = parseInt(event.key, 10);
            const threadTabs = threadTabsByProjectTabId[activeProjectTabId] || [];
            if (threadTabs[num - 1]) {
              viewThreadRef.current?.(String(threadTabs[num - 1].id));
            }
            break;
          }
          default:
            break;
        }
        return;
      }
      if (!ctrlKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const isInputFocused = !!(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable));
      const selection = typeof window.getSelection === "function" ? window.getSelection() : null;
      const hasSelectedText = !!selection && !selection.isCollapsed && `${selection}`.trim().length > 0;
      const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
      if ((key === "c" || key === "x") && hasSelectedText) {
        return;
      }
      if (key === "a" && !isInputFocused) {
        return;
      }
      if (isInputFocused && !event.shiftKey && event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      switch (event.key) {
        case "Enter":
          if (!isInputFocused || event.shiftKey) {
            sendMessageRef.current?.().catch(() => {});
          }
          break;
        case "p":
        case "P":
          if (event.shiftKey && collaborationMode !== "plan" && !modeSwitchBusy) {
            api("/api/command", { method: "POST", body: JSON.stringify({ command_line: "/mode plan" }) }).then((result) => {
              const meta = (result?.meta as Record<string, unknown> | undefined) || undefined;
              if (meta?.collaboration_mode) {
                setCollaborationMode("plan");
              }
            }).catch(() => {});
          }
          break;
        case "b":
        case "B":
          if (collaborationMode !== "build" && !modeSwitchBusy) {
            api("/api/command", { method: "POST", body: JSON.stringify({ command_line: "/mode build" }) }).then((result) => {
              const meta = (result?.meta as Record<string, unknown> | undefined) || undefined;
              if (meta?.collaboration_mode) {
                setCollaborationMode("build");
              }
            }).catch(() => {});
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcutModalPage, interactionBusy, activeThread, activeProjectTabId, threadTabsByProjectTabId, collaborationMode, modeSwitchBusy, isCompactWorkspaceLayout, focusComposerRef]);

  useEffect(() => {
    if (shortcutModalPage !== "project" || typeof window === "undefined") {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (projectSearchQuery) {
          setProjectSearchQuery("");
          return;
        }
        setShortcutModalPage("main");
        return;
      }
      if (event.key === "Enter") {
        const target = filteredProjects[selectedProjectIndex];
        if (target && typeof target.key === "string") {
          selectProjectRef.current?.(target.key).catch(() => {});
          setShortcutModalPage("main");
          setProjectSearchQuery("");
        }
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedProjectIndex((prev) => Math.min(prev + 1, filteredProjects.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedProjectIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (event.key === "Backspace" && !projectSearchQuery) {
        setShortcutModalPage("main");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcutModalPage, projectSearchQuery, filteredProjects, selectedProjectIndex]);
}
