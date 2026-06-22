import { useCallback, useEffect, useMemo } from "react";

import { api } from "../../common/api";
import { groupMessagesForRender, normalizeThreadId } from "../../common/utils";
import useThreadScopedState from "../../thread/hooks/useThreadScopedState";
import useAgentConfigDomain from "./useAgentConfigDomain";
import useAppRuntimeRefs from "./useAppRuntimeRefs";
import useProjectThreadTabs from "./useProjectThreadTabs";
import useThreadSession from "./useThreadSession";
import useWorkspaceDomain from "./useWorkspaceDomain";
import {
  WORKSPACE_PREVIEW_HEIGHT_STORAGE_KEY,
  WORKSPACE_PREVIEW_WIDTH_STORAGE_KEY,
  WORKSPACE_PREVIEW_DEFAULT_HEIGHT,
  WORKSPACE_PREVIEW_DEFAULT_WIDTH,
  WORKSPACE_PREVIEW_MIN_HEIGHT,
  WORKSPACE_PREVIEW_MAX_HEIGHT,
  WORKSPACE_PREVIEW_MIN_WIDTH,
  WORKSPACE_PREVIEW_MAX_WIDTH,
} from "./workspacePreviewConstants";

function readWorkspacePreviewHeight(defaultHeight, minHeight, maxHeight) {
  if (typeof window === "undefined") {
    return defaultHeight;
  }
  try {
    const raw = window.localStorage.getItem(WORKSPACE_PREVIEW_HEIGHT_STORAGE_KEY);
    const parsed = Number.parseInt(raw || "", 10);
    if (Number.isFinite(parsed)) {
      return Math.max(minHeight, Math.min(maxHeight, parsed));
    }
  } catch (_err) {}
  return defaultHeight;
}

function readWorkspacePreviewWidth(defaultWidth, minWidth, maxWidth) {
  if (typeof window === "undefined") {
    return defaultWidth;
  }
  try {
    const raw = window.localStorage.getItem(WORKSPACE_PREVIEW_WIDTH_STORAGE_KEY);
    const parsed = Number.parseInt(raw || "", 10);
    if (Number.isFinite(parsed)) {
      return Math.max(minWidth, Math.min(maxWidth, parsed));
    }
  } catch (_err) {}
  return defaultWidth;
}

export function normalizeCollaborationMode(raw: unknown) {
  if (typeof raw !== "string") {
    return "build";
  }
  return raw.trim().toLowerCase() === "plan" ? "plan" : "build";
}

export function buildProjectTabStatusById(
  projectTabs: Array<Record<string, unknown>>,
  threadTabsByProjectTabId: Record<string, Array<Record<string, unknown>>>
) {
  const next: Record<string, string> = {};
  projectTabs.forEach((tab) => {
    const tabId = String(tab.id ?? "");
    const rows = Array.isArray(threadTabsByProjectTabId[tabId])
      ? threadTabsByProjectTabId[tabId]
      : [];
    if (rows.some((row) => row.status === "running")) {
      next[tabId] = "running";
    } else if (rows.some((row) => row.hasUnreadCompletion)) {
      next[tabId] = "unread";
    } else if (rows.some((row) => row.status === "failed")) {
      next[tabId] = "failed";
    } else if (rows.some((row) => row.status === "cancelled")) {
      next[tabId] = "cancelled";
    } else {
      next[tabId] = "idle";
    }
  });
  return next;
}

export default function useAppDomainRuntime({ me, domains }) {
  const { threads, session, ui } = domains;
  const refs = useAppRuntimeRefs();
  const showToast = useCallback((message, type = "info") => {
    if (refs.toastTimerRef.current) clearTimeout(refs.toastTimerRef.current);
    ui.setToastNotification({ message, type });
    refs.toastTimerRef.current = setTimeout(() => {
      ui.setToastNotification(null);
      refs.toastTimerRef.current = null;
    }, 5000);
  }, [ui.setToastNotification]);
  const debugLoggingEnabled =
    (typeof me?.logging_level === "string" && me.logging_level.toUpperCase() === "DEBUG") ||
    me?.debug_logging === true;
  const debugLog = useCallback((...args) => {
    if (debugLoggingEnabled) {
      console.log(...args);
    }
  }, [debugLoggingEnabled]);
  const debugError = useCallback((...args) => {
    if (debugLoggingEnabled) {
      console.error(...args);
    }
  }, [debugLoggingEnabled]);
  const threadState = useThreadScopedState(threads.activeThread);
  const activeProjectTab = useMemo(
    () => threads.projectTabs.find((tab) => tab.id === threads.activeProjectTabId) || null,
    [threads.projectTabs, threads.activeProjectTabId]
  );
  const activeProjectKey = activeProjectTab?.key || "";
  const activeSubagents = Array.isArray(session.sessionSummary?.active_subagents)
    ? session.sessionSummary.active_subagents.filter(
        (item) => item && typeof item === "object"
      )
    : [];
  const workspace = useWorkspaceDomain({
    activeThread: threads.activeThread,
    activeProjectTabId: threads.activeProjectTabId,
    activeProjectKey,
    threadProjectTabIdByThreadId: threads.threadProjectTabIdByThreadId,
    activeProjectTabPath: activeProjectTab?.path || "",
    sessionWorkspace: session.sessionSummary?.workspace || "",
    readWorkspacePreviewWidth,
    readWorkspacePreviewHeight,
    workspacePreviewDefaults: {
      minWidth: WORKSPACE_PREVIEW_MIN_WIDTH,
      maxWidth: WORKSPACE_PREVIEW_MAX_WIDTH,
      defaultWidth: WORKSPACE_PREVIEW_DEFAULT_WIDTH,
      minHeight: WORKSPACE_PREVIEW_MIN_HEIGHT,
      maxHeight: WORKSPACE_PREVIEW_MAX_HEIGHT,
      defaultHeight: WORKSPACE_PREVIEW_DEFAULT_HEIGHT,
    },
  });
  const renderItems = useMemo(
    () => groupMessagesForRender(threadState.messages),
    [threadState.messages]
  );
  const interactionBusy = threadState.status === "running";
  const projectTabStatusById = useMemo(
    () =>
      buildProjectTabStatusById(
        threads.projectTabs,
        threads.threadTabsByProjectTabId
      ),
    [threads.projectTabs, threads.threadTabsByProjectTabId]
  );

  useEffect(() => {
    return () => {
      if (refs.toastTimerRef.current) clearTimeout(refs.toastTimerRef.current);
    };
  }, []);
  useEffect(() => {
    refs.activeProjectTabIdRef.current = threads.activeProjectTabId;
  }, [threads.activeProjectTabId]);
  useEffect(() => {
    refs.activeProjectKeyRef.current = activeProjectKey;
  }, [activeProjectKey]);
  useEffect(() => {
    refs.threadProjectTabIdByThreadIdRef.current =
      threads.threadProjectTabIdByThreadId;
  }, [threads.threadProjectTabIdByThreadId]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__CODEX_WEB_DEBUG__ = debugLoggingEnabled;
    }
  }, [debugLoggingEnabled]);

  const projectThreadTabs = useProjectThreadTabs({
    projectTabs: threads.projectTabs,
    setProjectTabs: threads.setProjectTabs,
    projectTabSequenceRef: refs.projectTabSequenceRef,
    setThreadTabsByProjectTabId: threads.setThreadTabsByProjectTabId,
    setThreadProjectTabIdByThreadId: threads.setThreadProjectTabIdByThreadId,
    ensureWorkspaceBucket: workspace.ensureWorkspaceBucket,
    setActiveThreadTabIdByProjectTabId:
      threads.setActiveThreadTabIdByProjectTabId,
    activeProjectTabId: threads.activeProjectTabId,
    setActiveThread: threads.setActiveThread,
    threadProjectTabIdByThreadIdRef: refs.threadProjectTabIdByThreadIdRef,
    threadTabsByProjectTabId: threads.threadTabsByProjectTabId,
    removeWorkspaceBucket: workspace.removeWorkspaceBucket,
    activeThreadTabIdByProjectTabId: threads.activeThreadTabIdByProjectTabId,
    setActiveProjectTabId: threads.setActiveProjectTabId,
    setMessages: threadState.setMessages,
  });

  const closeThreadTab = (projectTabId, threadId) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    if (!projectTabId || !normalizedThreadId) {
      return;
    }
    const rows = Array.isArray(threads.threadTabsByProjectTabId[projectTabId])
      ? threads.threadTabsByProjectTabId[projectTabId]
      : [];
    const index = rows.findIndex((row) => row.id === normalizedThreadId);
    if (index < 0) {
      return;
    }
    const nextRows = rows.filter((row) => row.id !== normalizedThreadId);
    const fallback = nextRows[index] || nextRows[index - 1] || nextRows[0];
    const isClosingActiveThread =
      projectTabId === threads.activeProjectTabId &&
      normalizeThreadId(threads.activeThread) === normalizedThreadId;
    threads.setThreadTabsByProjectTabId((prev) => ({
      ...prev,
      [projectTabId]: nextRows,
    }));
    if (projectTabId === threads.activeProjectTabId) {
      projectThreadTabs.setActiveThreadForProjectTab(
        projectTabId,
        fallback?.id || ""
      );
    } else {
      threads.setActiveThreadTabIdByProjectTabId((mapping) => ({
        ...mapping,
        [projectTabId]: fallback?.id || "",
      }));
    }
    if (isClosingActiveThread) {
      if (fallback?.id) {
        threadSession.viewThread(fallback.id).catch(() => {});
      } else {
        threadState.setMessages([]);
      }
    }
    threads.setThreadProjectTabIdByThreadId((prev) => {
      const next = { ...prev };
      delete next[normalizedThreadId];
      return next;
    });
    threadState.setMessagesByThreadId((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, normalizedThreadId)) {
        return prev;
      }
      const next = { ...prev };
      delete next[normalizedThreadId];
      return next;
    });
    threadState.setThreadUiByThreadId((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, normalizedThreadId)) {
        return prev;
      }
      const next = { ...prev };
      delete next[normalizedThreadId];
      return next;
    });
    workspace.removeWorkspaceBucket(normalizedThreadId);
  };

  const playTurnNotification = () => {
    if (!ui.turnNotificationEnabled || typeof window === "undefined") {
      return;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        return;
      }
      if (!refs.audioCtxRef.current) {
        refs.audioCtxRef.current = new AudioCtx();
      }
      const ctx = refs.audioCtxRef.current;
      if (!ctx) {
        return;
      }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (_err) {}
    showToast("Turn completed!", "success");
  };

  const threadSession = useThreadSession({
    api,
    me,
    activeProjectKey,
    activeProjectTabId: threads.activeProjectTabId,
    activeThread: threads.activeThread,
    isMobileLayout: ui.isMobileLayout,
    interactionBusy,
    projectTabs: threads.projectTabs,
    projectItems: threads.projectItems,
    threadItems: threads.threadItems,
    threadTabsByProjectTabId: threads.threadTabsByProjectTabId,
    activeThreadTabIdByProjectTabId: threads.activeThreadTabIdByProjectTabId,
    threadProjectTabIdByThreadId: threads.threadProjectTabIdByThreadId,
    initialLoadRef: refs.initialLoadRef,
    activeThreadRef: threadState.activeThreadRef,
    pendingComposerFocusRef: refs.pendingComposerFocusRef,
    turnThreadIdRef: threadState.turnThreadIdRef,
    setThreadItems: threads.setThreadItems,
    setProjectItems: threads.setProjectItems,
    setSessionSummary: session.setSessionSummary,
    setProjectTabs: threads.setProjectTabs,
    setThreadTabsByProjectTabId: threads.setThreadTabsByProjectTabId,
    setThreadProjectTabIdByThreadId: threads.setThreadProjectTabIdByThreadId,
    setActiveThreadTabIdByProjectTabId:
      threads.setActiveThreadTabIdByProjectTabId,
    setActiveProjectTabId: threads.setActiveProjectTabId,
    setActiveThread: threads.setActiveThread,
    setMessagesByThreadId: threadState.setMessagesByThreadId,
    setMessages: threadState.setMessages,
    setStatus: threadState.setStatus,
    setStatusForThread: threadState.setStatusForThread,
    setStatusForActiveThread: threadState.setStatusForActiveThread,
    setCollaborationMode: session.setCollaborationMode,
    setIsSidebarOpen: ui.setIsSidebarOpen,
    setPendingProjectTarget: ui.setPendingProjectTarget,
    setIsProjectModeModalOpen: ui.setIsProjectModeModalOpen,
    appendMessageToThread: threadState.appendMessageToThread,
    restoreThreadMessages: threadState.restoreThreadMessages,
    updateThreadUi: threadState.updateThreadUi,
    upsertProjectTab: projectThreadTabs.upsertProjectTab,
    openThreadInProjectTab: projectThreadTabs.openThreadInProjectTab,
    setActiveThreadForProjectTab:
      projectThreadTabs.setActiveThreadForProjectTab,
    updateThreadTabState: projectThreadTabs.updateThreadTabState,
    ensureWorkspaceBucket: workspace.ensureWorkspaceBucket,
    removeWorkspaceBucket: workspace.removeWorkspaceBucket,
    normalizeCollaborationMode,
  });

  const chooseProjectClickMode = (mode) => {
    const normalizedMode =
      mode === "replace_current" ? "replace_current" : "open_new_tab";
    const target = ui.pendingProjectTarget;
    ui.setPendingProjectTarget("");
    ui.setIsProjectModeModalOpen(false);
    if (target) {
      threadSession.selectProject(target, normalizedMode).catch(() => {});
    }
  };
  const loadSkillSuggestions = async () => {
    const result = await api("/api/skills");
    const skills = Array.isArray(result.meta?.skill_names)
      ? result.meta.skill_names
      : [];
    threads.setSkillSuggestions([
      ...new Set(skills.filter((value) => typeof value === "string" && value)),
    ]);
  };
  const agentActions = useAgentConfigDomain({
    api,
    activeAgentSettings: session.activeAgentSettings,
    agentConfigs: session.agentConfigs,
    agentConfigRawEditors: session.agentConfigRawEditors,
    agentConfigSaving: session.agentConfigSaving,
    agentConfigLoading: session.agentConfigLoading,
    setSessionSummary: session.setSessionSummary,
    setAgentConfigs: session.setAgentConfigs,
    setAgentConfigRawEditors: session.setAgentConfigRawEditors,
    setActiveAgentSettings: session.setActiveAgentSettings,
    setFloatingAgentSettings: session.setFloatingAgentSettings,
    setAgentConfigLoading: session.setAgentConfigLoading,
    setAgentConfigSaving: session.setAgentConfigSaving,
    setAgentConfigError: session.setAgentConfigError,
  });

  return {
    refs,
    threadState,
    workspace,
    activeProjectTab,
    activeProjectKey,
    activeSubagents,
    renderItems,
    interactionBusy,
    projectTabStatusById,
    projectThreadTabs,
    threadActions: {
      ...threadSession,
      closeProjectTab: projectThreadTabs.closeProjectTab,
      collapseProjectTab: projectThreadTabs.collapseProjectTab,
      closeThreadTab,
      chooseProjectClickMode,
    },
    agentActions,
    loadSkillSuggestions,
    playTurnNotification,
    showToast,
    debugLog,
    debugError,
  };
}
