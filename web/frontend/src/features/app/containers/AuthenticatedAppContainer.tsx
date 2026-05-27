import { useCallback, useEffect, useMemo, useRef } from "react";

import AuthenticatedAppPresenter from "../components/AuthenticatedAppPresenter";
import AppMainPresenter from "../components/AppMainPresenter";
import AppOverlaysPresenter from "../components/AppOverlaysPresenter";
import AppSidebarPresenter from "../components/AppSidebarPresenter";
import AppCenterPanePresenter from "../components/AppCenterPanePresenter";
import AppComposerPresenter from "../components/AppComposerPresenter";
import AppSidebarContentPanel from "../components/AppSidebarContentPanel";
import FloatingGuardianSettingsPanel from "../components/FloatingGuardianSettingsPanel";
import WorkspacePreviewOverlay from "../components/WorkspacePreviewOverlay";
import WorkspacePanel from "../../workspace/components/WorkspacePanel";
import ApprovalStack from "../../approvals/components/ApprovalStack";
import useApprovalFlow from "../../approvals/hooks/useApprovalFlow";
import ChatMessageFeed from "../../chat/components/ChatMessageFeed";
import { AGENT_CONFIG_DEFS } from "../../common/constants";
import { api } from "../../common/api";
import {
  FolderIcon,
  MenuIcon,
  NewChatIcon,
  SendIcon,
  SidebarChevronIcon,
  StopIcon,
} from "../../common/components/Icons";
import { persistTurnNotificationEnabled, readTurnNotificationEnabled } from "../../common/theme";
import {
  basename,
  formatGuardianRulesEditor,
  formatPlanChecklistText,
  groupMessagesForRender,
  normalizeThreadId,
  summarizeReasoningStatus,
} from "../../common/utils";
import TopTabs from "../../tabs/components/TopTabs";
import useSessionDomain from "../hooks/useSessionDomain";
import useThreadsDomain from "../hooks/useThreadsDomain";
import useUiDomain from "../hooks/useUiDomain";
import useWorkspaceDomain from "../hooks/useWorkspaceDomain";
import useProjectThreadTabs from "../hooks/useProjectThreadTabs";
import useThreadSession from "../hooks/useThreadSession";
import useTurnSession from "../hooks/useTurnSession";
import useViewportLayout from "../hooks/useViewportLayout";
import useResizeInteractions from "../hooks/useResizeInteractions";
import useGlobalKeyboardShortcuts from "../hooks/useGlobalKeyboardShortcuts";
import useComposerPalette from "../hooks/useComposerPalette";
import useComposerInputHandlers from "../hooks/useComposerInputHandlers";
import useAgentConfigDomain from "../hooks/useAgentConfigDomain";
import useTurnMessageMutations from "../hooks/useTurnMessageMutations";
import useChatScrollEffects from "../hooks/useChatScrollEffects";
import useComposerFocusEffects from "../hooks/useComposerFocusEffects";
import usePaletteEffects from "../hooks/usePaletteEffects";
import useThreadBootstrapEffects from "../hooks/useThreadBootstrapEffects";
import useMessageCommandActions from "../hooks/useMessageCommandActions";
import useAppUiEffects from "../hooks/useAppUiEffects";
import useThreadScopedState from "../../thread/hooks/useThreadScopedState";
import { getSidebarStyle, getWorkspacePanelStyle } from "../state/layoutSelectors";

const WORKSPACE_PREVIEW_HEIGHT_STORAGE_KEY = "codex-web-workspace-preview-height";
const WORKSPACE_PREVIEW_WIDTH_STORAGE_KEY = "codex-web-workspace-preview-width";

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

function persistWorkspacePreviewHeight(height) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(WORKSPACE_PREVIEW_HEIGHT_STORAGE_KEY, String(height));
  } catch (_err) {}
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

function persistWorkspacePreviewWidth(width) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(WORKSPACE_PREVIEW_WIDTH_STORAGE_KEY, String(width));
  } catch (_err) {}
}

function clearWorkspacePreviewSize() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(WORKSPACE_PREVIEW_HEIGHT_STORAGE_KEY);
    window.localStorage.removeItem(WORKSPACE_PREVIEW_WIDTH_STORAGE_KEY);
  } catch (_err) {}
}

function AuthenticatedAppContainer({ me, theme, onToggleTheme }) {
  const PALETTE_LIMIT = 10;
  const SIDEBAR_MIN = 260;
  const SIDEBAR_MAX = 620;
  const SIDEBAR_COLLAPSED_WIDTH = 44;
  const WORKSPACE_PANEL_MIN = 280;
  const WORKSPACE_PANEL_MAX = 720;
  const WORKSPACE_PREVIEW_MIN_HEIGHT = 280;
  const WORKSPACE_PREVIEW_MAX_HEIGHT = 820;
  const WORKSPACE_PREVIEW_DEFAULT_HEIGHT = 560;
  const WORKSPACE_PREVIEW_MIN_WIDTH = 420;
  const WORKSPACE_PREVIEW_MAX_WIDTH = 1200;
  const WORKSPACE_PREVIEW_DEFAULT_WIDTH = 860;
  const MOBILE_BREAKPOINT = 900;
  const WORKSPACE_PANEL_BREAKPOINT = 1200;
  const {
    projectTabs,
    activeProjectTabId,
    threadTabsByProjectTabId,
    activeThreadTabIdByProjectTabId,
    threadProjectTabIdByThreadId,
    activeThread,
    threadItems,
    projectItems,
    projectSuggestions,
    skillSuggestions,
    setProjectTabs,
    setActiveProjectTabId,
    setThreadTabsByProjectTabId,
    setActiveThreadTabIdByProjectTabId,
    setThreadProjectTabIdByThreadId,
    setActiveThread,
    setThreadItems,
    setProjectItems,
    setProjectSuggestions,
    setSkillSuggestions,
  } = useThreadsDomain();
  const {
    sessionSummary,
    collaborationMode,
    modeSwitchBusy,
    agentConfigs,
    agentConfigRawEditors,
    activeAgentSettings,
    floatingAgentSettings,
    agentConfigLoading,
    agentConfigSaving,
    agentConfigError,
    setSessionSummary,
    setCollaborationMode,
    setModeSwitchBusy,
    setAgentConfigs,
    setAgentConfigRawEditors,
    setActiveAgentSettings,
    setFloatingAgentSettings,
    setAgentConfigLoading,
    setAgentConfigSaving,
    setAgentConfigError,
  } = useSessionDomain();
  const {
    approvalItems,
    approvalBusyId,
    setApprovalItems,
    setApprovalBusyId,
    loadApprovals,
    submitApproval,
  } = useApprovalFlow({ api });
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const reasoningStateRef = useRef({});
  const activeProjectTabIdRef = useRef("");
  const activeProjectKeyRef = useRef("");
  const threadProjectTabIdByThreadIdRef = useRef({});
  const pendingComposerFocusRef = useRef(false);
  const composerFocusWantedRef = useRef(false);
  const composerSelectionRef = useRef({ start: null, end: null });
  const recentBackspaceAtRef = useRef(0);
  const paletteRef = useRef(null);
  const workspacePreviewResizeRef = useRef({
    mode: "",
    startX: 0,
    startY: 0,
    startWidth: WORKSPACE_PREVIEW_DEFAULT_WIDTH,
    startHeight: WORKSPACE_PREVIEW_DEFAULT_HEIGHT,
  });
  const workspaceResizeRef = useRef({ startX: 0, startWidth: 320 });
  const projectTabSequenceRef = useRef(0);
  const initialLoadRef = useRef(true);
  const streamedTurnIdsRef = useRef({});
  const assistantItemCompletedByTurnRef = useRef({});
  const sendMessageRef = useRef(null);
  const startThreadRef = useRef(null);
  const closeThreadTabRef = useRef(null);
  const viewThreadRef = useRef(null);
  const selectProjectRef = useRef(null);
  const focusComposerRef = useRef(null);
  const setInputForActiveThreadRef = useRef(null);
  const inputHistoryIndexRef = useRef(-1);
  const {
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
  } = useUiDomain({
    mobileBreakpoint: MOBILE_BREAKPOINT,
    workspacePanelBreakpoint: WORKSPACE_PANEL_BREAKPOINT,
    readTurnNotificationEnabled,
  });

  const showToast = useCallback((message, type = "info") => {
    setToastNotification({ message, type });
    setTimeout(() => setToastNotification(null), 5000);
  }, [setToastNotification]);
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
  const audioCtxRef = useRef(null);
  const itemPhaseByTurnRef = useRef({});
  const {
    messages,
    setMessages,
    input,
    setInputForActiveThread,
    status,
    setStatus,
    setStatusForActiveThread,
    setStatusForThread,
    activityDetail,
    setActivityDetail,
    setActivityDetailForThread,
    messagesByThreadId,
    setMessagesByThreadId,
    threadUiByThreadId,
    setThreadUiByThreadId,
    activeThreadRef,
    turnThreadIdRef,
    restoreThreadMessages,
    appendMessageToThread,
    applyMessageMutationForThread,
    updateThreadUi,
    resolveThreadIdFromTurn,
  } = useThreadScopedState(activeThread);
  const activeProjectTabSnapshot = projectTabs.find((tab) => tab.id === activeProjectTabId) || null;
  const activeSubagents = Array.isArray(sessionSummary?.active_subagents)
    ? sessionSummary.active_subagents.filter((item) => item && typeof item === "object")
    : [];
  const {
    workspacePanelWidth,
    isResizingWorkspacePanel,
    workspacePreviewWidth,
    workspacePreviewHeight,
    isResizingWorkspacePreview,
    setWorkspacePanelWidth,
    setIsResizingWorkspacePanel,
    setWorkspacePreviewWidth,
    setWorkspacePreviewHeight,
    setIsResizingWorkspacePreview,
    ensureWorkspaceBucket,
    removeWorkspaceBucket,
    restoreWorkspaceForThread,
    workspaceTree,
    expandedWorkspaceDirs,
    workspaceStatus,
    workspaceError,
    setWorkspaceError,
    workspacePreview,
    setWorkspacePreview,
    workspaceContextQuery,
    loadWorkspaceStatus,
    refreshWorkspaceBrowser,
    openWorkspaceFile,
    toggleWorkspaceDirectory,
  } = useWorkspaceDomain({
    activeThread,
    activeProjectTabId,
    activeProjectKey: activeProjectTabSnapshot?.key || "",
    threadProjectTabIdByThreadId,
    activeProjectTabPath: activeProjectTabSnapshot?.path || "",
    sessionWorkspace: sessionSummary?.workspace || "",
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
  const slashCommands = useMemo(
    () => [
      "/commands",
      "/start",
      "/resume",
      "/fork",
      "/threads",
      "/read",
      "/archive",
      "/unarchive",
      "/compact",
      "/rollback",
      "/interrupt",
      "/review",
      "/exec",
      "/projects",
      "/project",
      "/models",
      "/collab",
      "/features",
      "/modes",
      "/mode",
      "/plan",
      "/build",
      "/skills",
      "/apps",
      "/mcp",
      "/config",
    ],
    []
  );
  const { activeToken, paletteItems, paletteOpen, paletteWindowStart, visiblePaletteItems } = useComposerPalette({
    input,
    slashCommands,
    projectSuggestions,
    skillSuggestions,
    paletteSelectedIndex,
    paletteLimit: PALETTE_LIMIT,
  });
  const renderItems = useMemo(() => groupMessagesForRender(messages), [messages]);
  const activeProjectTab = useMemo(
    () => projectTabs.find((tab) => tab.id === activeProjectTabId) || null,
    [projectTabs, activeProjectTabId]
  );
  const activeProjectKey = activeProjectTab?.key || "";
  const interactionBusy = status === "running";
  const composerLocked = interactionBusy;

  useEffect(() => {
    activeProjectTabIdRef.current = activeProjectTabId;
  }, [activeProjectTabId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__CODEX_WEB_DEBUG__ = debugLoggingEnabled;
    }
  }, [debugLoggingEnabled]);

  useEffect(() => {
    activeProjectKeyRef.current = activeProjectKey;
  }, [activeProjectKey]);

  useEffect(() => {
    threadProjectTabIdByThreadIdRef.current = threadProjectTabIdByThreadId;
  }, [threadProjectTabIdByThreadId]);
  const projectTabStatusById = useMemo(() => {
    const next = {};
    projectTabs.forEach((tab) => {
      const rows = Array.isArray(threadTabsByProjectTabId[tab.id]) ? threadTabsByProjectTabId[tab.id] : [];
      if (rows.some((row) => row.status === "running")) {
        next[tab.id] = "running";
        return;
      }
      if (rows.some((row) => row.hasUnreadCompletion)) {
        next[tab.id] = "unread";
        return;
      }
      if (rows.some((row) => row.status === "failed")) {
        next[tab.id] = "failed";
        return;
      }
      if (rows.some((row) => row.status === "cancelled")) {
        next[tab.id] = "cancelled";
        return;
      }
      next[tab.id] = "idle";
    });
    return next;
  }, [projectTabs, threadTabsByProjectTabId]);

  function normalizeCollaborationMode(raw) {
    if (typeof raw !== "string") {
      return "build";
    }
    return raw.trim().toLowerCase() === "plan" ? "plan" : "build";
  }

  const {
    upsertProjectTab,
    setActiveThreadForProjectTab,
    openThreadInProjectTab,
    updateThreadTabState,
    closeProjectTab,
  } = useProjectThreadTabs({
    projectTabs,
    setProjectTabs,
    projectTabSequenceRef,
    setThreadTabsByProjectTabId,
    setThreadProjectTabIdByThreadId,
    ensureWorkspaceBucket,
    setActiveThreadTabIdByProjectTabId,
    activeProjectTabId,
    setActiveThread,
    threadProjectTabIdByThreadIdRef,
    threadTabsByProjectTabId,
    removeWorkspaceBucket,
    activeThreadTabIdByProjectTabId,
    setActiveProjectTabId,
    setMessages,
  });

  const closeThreadTab = (projectTabId, threadId) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    if (!projectTabId || !normalizedThreadId) {
      return;
    }
    const rows = Array.isArray(threadTabsByProjectTabId[projectTabId]) ? threadTabsByProjectTabId[projectTabId] : [];
    const index = rows.findIndex((row) => row.id === normalizedThreadId);
    if (index < 0) {
      return;
    }
    const nextRows = rows.filter((row) => row.id !== normalizedThreadId);
    const fallback = nextRows[index] || nextRows[index - 1] || nextRows[0];
    const isClosingActiveThread =
      projectTabId === activeProjectTabId && normalizeThreadId(activeThread) === normalizedThreadId;
    setThreadTabsByProjectTabId((prev) => ({ ...prev, [projectTabId]: nextRows }));
    if (projectTabId === activeProjectTabId) {
      setActiveThreadForProjectTab(projectTabId, fallback?.id || "");
    } else {
      setActiveThreadTabIdByProjectTabId((mapping) => ({
        ...mapping,
        [projectTabId]: fallback?.id || "",
      }));
    }
    if (isClosingActiveThread) {
      if (fallback?.id) {
        viewThread(fallback.id).catch(() => {});
      } else {
        setMessages([]);
      }
    }
    setThreadProjectTabIdByThreadId((prev) => {
      const next = { ...prev };
      delete next[normalizedThreadId];
      return next;
    });
    setMessagesByThreadId((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, normalizedThreadId)) {
        return prev;
      }
      const next = { ...prev };
      delete next[normalizedThreadId];
      return next;
    });
    setThreadUiByThreadId((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, normalizedThreadId)) {
        return prev;
      }
      const next = { ...prev };
      delete next[normalizedThreadId];
      return next;
    });
    removeWorkspaceBucket(normalizedThreadId);
  };

  const playTurnNotification = () => {
    if (!turnNotificationEnabled || typeof window === "undefined") {
      return;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        return;
      }
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
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

  const {
    loadThreads,
    loadProjects,
    loadSessionSummary,
    resolveCurrentThreadId,
    syncThreadMessagesFromServer,
    startThread,
    selectProject,
    viewThread,
    runCommand,
  } = useThreadSession({
    api,
    me,
    activeProjectKey,
    activeProjectTabId,
    activeThread,
    isMobileLayout,
    interactionBusy,
    projectTabs,
    projectItems,
    threadItems,
    threadTabsByProjectTabId,
    activeThreadTabIdByProjectTabId,
    threadProjectTabIdByThreadId,
    initialLoadRef,
    activeThreadRef,
    pendingComposerFocusRef,
    turnThreadIdRef,
    setThreadItems,
    setProjectItems,
    setSessionSummary,
    setProjectTabs,
    setThreadTabsByProjectTabId,
    setThreadProjectTabIdByThreadId,
    setActiveThreadTabIdByProjectTabId,
    setActiveProjectTabId,
    setActiveThread,
    setMessagesByThreadId,
    setMessages,
    setStatus,
    setStatusForThread,
    setStatusForActiveThread,
    setCollaborationMode,
    setIsSidebarOpen,
    setPendingProjectTarget,
    setIsProjectModeModalOpen,
    appendMessageToThread,
    restoreThreadMessages,
    updateThreadUi,
    upsertProjectTab,
    openThreadInProjectTab,
    setActiveThreadForProjectTab,
    updateThreadTabState,
    ensureWorkspaceBucket,
    removeWorkspaceBucket,
    normalizeCollaborationMode,
  });

  const chooseProjectClickMode = (mode) => {
    const normalizedMode = mode === "replace_current" ? "replace_current" : "open_new_tab";
    const target = pendingProjectTarget;
    setPendingProjectTarget("");
    setIsProjectModeModalOpen(false);
    if (target) {
      selectProject(target, normalizedMode).catch(() => {});
    }
  };

  async function loadSkillSuggestions() {
    const skillsResult = await api("/api/skills");
    const skills = Array.isArray(skillsResult.meta?.skill_names) ? skillsResult.meta.skill_names : [];
    setSkillSuggestions([...new Set(skills.filter((v) => typeof v === "string" && v))]);
  }

  const {
    loadAgentConfig,
    toggleAgent,
    openAgentSettings,
    toggleFloatingAgentSettings,
    updateAgentDraft,
    saveAgentSettings,
  } = useAgentConfigDomain({
    api,
    activeAgentSettings,
    agentConfigs,
    agentConfigRawEditors,
    agentConfigSaving,
    agentConfigLoading,
    setSessionSummary,
    setAgentConfigs,
    setAgentConfigRawEditors,
    setActiveAgentSettings,
    setFloatingAgentSettings,
    setAgentConfigLoading,
    setAgentConfigSaving,
    setAgentConfigError,
  });

  const {
    sendMessage,
    toggleComposerMode,
    interrupt,
    focusComposer,
    rememberComposerSelection,
    applyPaletteItem: applyPaletteItemRaw,
  } = useMessageCommandActions({
    api,
    input,
    inputRef,
    turnThreadIdRef,
    activeThread,
    activeProjectKey,
    activeProjectTabId,
    threadItems,
    status,
    modeSwitchBusy,
    normalizeThreadId,
    normalizeCollaborationMode,
    resolveCurrentThreadId,
    openThreadInProjectTab,
    setActiveThreadForProjectTab,
    setInputForActiveThread,
    setMessages,
    setModeSwitchBusy,
    setCollaborationMode,
    setStatusForThread,
    updateThreadUi,
    appendMessageToThread,
    runCommand,
    loadSessionSummary,
    pendingComposerFocusRef,
    composerSelectionRef,
  });

  const autoResizeInput = () => {
    const el = inputRef.current;
    if (!el) {
      return;
    }
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 240);
    el.style.height = `${Math.max(40, next)}px`;
  };

  const applyPaletteItem = (item) => {
    applyPaletteItemRaw(item, activeToken, input);
  };

  const { upsertPlanMessage, upsertPlanChecklist, appendReasoningStatus, completeReasoning } =
    useTurnMessageMutations({
      applyMessageMutationForThread,
      normalizeThreadId,
      formatPlanChecklistText,
      summarizeReasoningStatus,
      reasoningStateRef,
      setActivityDetailForThread,
    });

  useTurnSession({
    me,
    turnNotificationEnabled,
    loadProjects,
    loadThreads,
    loadSkillSuggestions,
    loadSessionSummary,
    loadApprovals,
    loadWorkspaceStatus,
    refreshWorkspaceBrowser,
    activeProjectKey,
    activeProjectTabId,
    activeThreadRef,
    activeProjectKeyRef,
    activeProjectTabIdRef,
    streamedTurnIdsRef,
    assistantItemCompletedByTurnRef,
    itemPhaseByTurnRef,
    turnThreadIdRef,
    reasoningStateRef,
    debugLog,
    debugError,
    appendMessageToThread,
    applyMessageMutationForThread,
    appendReasoningStatus,
    completeReasoning,
    upsertPlanMessage,
    upsertPlanChecklist,
    setStatusForThread,
    setActivityDetailForThread,
    setMessages,
    updateThreadTabState,
    playTurnNotification,
    setApprovalBusyId,
    setApprovalItems,
    setCollaborationMode,
    normalizeCollaborationMode,
    resolveThreadIdFromTurn,
  });

  useChatScrollEffects({
    normalizeThreadId,
    activeThreadRef,
    messages,
    renderItems,
    debugLog,
    chatRef,
  });
  useComposerFocusEffects({
    status,
    pendingComposerFocusRef,
    focusComposer,
    input,
    autoResizeInput,
    composerFocusWantedRef,
    inputRef,
    rememberComposerSelection,
    composerSelectionRef,
    paletteOpen,
    paletteSelectedIndex,
  });
  usePaletteEffects({
    activeToken,
    setPaletteSelectedIndex,
    paletteItems,
    paletteSelectedIndex,
    paletteOpen,
    paletteRef,
    visiblePaletteItems,
  });
  useThreadBootstrapEffects({
    loadThreads,
    activeProjectKey,
    activeProjectTabId,
    resolveCurrentThreadId,
    setActiveThreadForProjectTab,
    restoreWorkspaceForThread,
    viewThread,
    setMessages,
    loadSessionSummary,
  });
  useViewportLayout({
    mobileBreakpoint: MOBILE_BREAKPOINT,
    workspacePanelBreakpoint: WORKSPACE_PANEL_BREAKPOINT,
    isMobileLayout,
    isSidebarOpen,
    isCompactWorkspaceLayout,
    setIsMobileLayout,
    setIsCompactWorkspaceLayout,
    setIsSidebarOpen,
    setIsResizingSidebar,
    setIsWorkspacePanelOpen,
    setIsResizingWorkspacePanel,
  });
  const { resetWorkspacePreviewSize } = useResizeInteractions({
    sidebarMin: SIDEBAR_MIN,
    sidebarMax: SIDEBAR_MAX,
    workspacePanelMin: WORKSPACE_PANEL_MIN,
    workspacePanelMax: WORKSPACE_PANEL_MAX,
    workspacePreviewMinWidth: WORKSPACE_PREVIEW_MIN_WIDTH,
    workspacePreviewMaxWidth: WORKSPACE_PREVIEW_MAX_WIDTH,
    workspacePreviewMinHeight: WORKSPACE_PREVIEW_MIN_HEIGHT,
    workspacePreviewMaxHeight: WORKSPACE_PREVIEW_MAX_HEIGHT,
    workspacePreviewDefaultWidth: WORKSPACE_PREVIEW_DEFAULT_WIDTH,
    workspacePreviewDefaultHeight: WORKSPACE_PREVIEW_DEFAULT_HEIGHT,
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
    persistWorkspacePreviewWidth,
    persistWorkspacePreviewHeight,
    clearWorkspacePreviewSize,
  });
  useAppUiEffects({
    activeToken,
    workspaceContextQuery,
    api,
    setProjectSuggestions,
    floatingAgentSettings,
    activeAgentSettings,
    setFloatingAgentSettings,
    isProjectModeModalOpen,
    setPendingProjectTarget,
    setIsProjectModeModalOpen,
    sendMessageRef,
    sendMessage,
    startThreadRef,
    startThread,
    closeThreadTabRef,
    closeThreadTab,
    viewThreadRef,
    viewThread,
    selectProjectRef,
    selectProject,
    focusComposerRef,
    focusComposer,
    setInputForActiveThreadRef,
    setInputForActiveThread,
  });

  const filteredProjects = useMemo(() => {
    const query = projectSearchQuery.toLowerCase();
    if (!query) {
      return projectItems;
    }
    return projectItems.filter(
      (item) =>
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.key && item.key.toLowerCase().includes(query))
    );
  }, [projectItems, projectSearchQuery]);

  useGlobalKeyboardShortcuts({
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
  });

  const { onInputChange, onInputFocus, onInputBlur, onInputSelect, onInputKeyDown } = useComposerInputHandlers({
    composerLocked,
    input,
    inputRef,
    activeThread,
    messagesByThreadId,
    composerFocusWantedRef,
    recentBackspaceAtRef,
    inputHistoryIndexRef,
    rememberComposerSelection,
    paletteOpen,
    paletteItems,
    paletteSelectedIndex,
    setPaletteSelectedIndex,
    setInputForActiveThread,
    applyPaletteItem,
    toggleComposerMode,
    sendMessage,
  });

  const activeAgentDef = activeAgentSettings ? AGENT_CONFIG_DEFS[activeAgentSettings] : null;
  const activeAgentConfig = activeAgentSettings ? agentConfigs[activeAgentSettings] : null;
  const floatingAgentConfig = floatingAgentSettings ? agentConfigs[floatingAgentSettings] : null;
  const guardianRuleSummary =
    activeAgentSettings === "guardian"
      ? (activeAgentConfig?.rule_summary || { enabled: 0, total: 0, action_counts: {}, top: [] })
      : null;
  const guardianRulesEditor =
    activeAgentSettings === "guardian"
      ? (agentConfigRawEditors[activeAgentSettings] ??
        formatGuardianRulesEditor(activeAgentConfig))
      : "";
  const settingsBusy = !!agentConfigLoading || !!agentConfigSaving;
  const currentProjectLabel = activeProjectTab?.name || sessionSummary?.project_name || sessionSummary?.project_key || "-";
  const workspaceRootLabel = basename(activeProjectTab?.path || sessionSummary?.workspace || "") || "Workspace";
  const workspacePanelStyle = getWorkspacePanelStyle(isCompactWorkspaceLayout, workspacePanelWidth);
  const workspaceStatusItems = useMemo(
    () => (workspaceStatus && typeof workspaceStatus.items === "object" ? workspaceStatus.items : {}),
    [workspaceStatus]
  );
  const workspacePanel = (
    <WorkspacePanel
      isCompactWorkspaceLayout={isCompactWorkspaceLayout}
      isWorkspacePanelOpen={isWorkspacePanelOpen}
      workspacePanelStyle={workspacePanelStyle}
      workspaceRootLabel={workspaceRootLabel}
      workspaceError={workspaceError}
      activeWorkspacePath={activeProjectTab?.path || sessionSummary?.workspace || ""}
      workspaceStatusItems={workspaceStatusItems}
      workspaceTree={workspaceTree}
      expandedWorkspaceDirs={expandedWorkspaceDirs}
      workspacePreview={workspacePreview}
      toggleWorkspaceDirectory={toggleWorkspaceDirectory}
      openWorkspaceFile={openWorkspaceFile}
      refreshWorkspaceBrowser={refreshWorkspaceBrowser}
      setWorkspaceError={setWorkspaceError}
      showToast={showToast}
    />
  );

  const isDesktopSidebarCollapsed = !isMobileLayout && isSidebarCollapsed;
  const sidebarStyle = getSidebarStyle({
    isMobileLayout,
    isDesktopSidebarCollapsed,
    sidebarWidth,
    collapsedWidth: SIDEBAR_COLLAPSED_WIDTH,
  });
  const projectModeModal = isProjectModeModalOpen ? (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={() => {
        setPendingProjectTarget("");
        setIsProjectModeModalOpen(false);
      }}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Project open mode"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-title">Choose Project Tab Behavior</div>
        <div className="modal-desc">
          Choose whether clicking a project opens it in a new tab or replaces the current tab.
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="primary"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => chooseProjectClickMode("open_new_tab")}
          >
            Open in New Tab
          </button>
          <button
            type="button"
            className="secondary"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => chooseProjectClickMode("replace_current")}
          >
            Replace Current Tab
          </button>
          <button
            type="button"
            className="ghost"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => {
              setPendingProjectTarget("");
              setIsProjectModeModalOpen(false);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const projectPickerModal = shortcutModalPage === "project" ? (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={() => {
        setShortcutModalPage("main");
        setProjectSearchQuery("");
      }}
    >
      <div
        className="modal-card project-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Project picker"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="project-picker-search">
          <input
            type="text"
            className="project-picker-input"
            placeholder="Search projects..."
            value={projectSearchQuery}
            onChange={(e) => setProjectSearchQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className="project-picker-list">
          {filteredProjects.length === 0 ? (
            <div className="project-picker-empty">No projects found</div>
          ) : (
            filteredProjects.map((item, idx) => (
              <button
                key={item.key}
                className={`project-picker-item ${idx === selectedProjectIndex ? "selected" : ""}`}
                onClick={() => {
                  selectProject(item.key).catch(() => {});
                  setShortcutModalPage("main");
                  setProjectSearchQuery("");
                }}
                onMouseEnter={() => setSelectedProjectIndex(idx)}
              >
                <span className="project-picker-name">{item.name || item.key}</span>
                <span className="project-picker-key">{item.key}</span>
                {item.default ? <span className="project-picker-badge">default</span> : null}
              </button>
            ))
          )}
        </div>
        <div className="project-picker-footer">
          <span><kbd>?묅넃</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Select</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  ) : null;

  const shortcutModal = null;

  return (
    <AuthenticatedAppPresenter>
    <div className={`app ${isMobileLayout ? "mobile-layout" : ""}`}>
      <AppOverlaysPresenter
        projectModeModal={projectModeModal}
        projectPickerModal={projectPickerModal}
        shortcutModal={shortcutModal}
        toastNotification={toastNotification}
      />
      <AppSidebarPresenter>
      <aside
        id="app-sidebar"
        className={`sidebar ${isMobileLayout ? "mobile" : "desktop"} ${isSidebarOpen ? "open" : ""} ${isDesktopSidebarCollapsed ? "collapsed" : ""}`}
        style={sidebarStyle}
        aria-hidden={isMobileLayout ? !isSidebarOpen : undefined}
      >
        {!isDesktopSidebarCollapsed ? (
          <div className="sidebar-content">
            <AppSidebarContentPanel
              turnNotificationEnabled={turnNotificationEnabled}
              setTurnNotificationEnabled={setTurnNotificationEnabled}
              persistTurnNotificationEnabled={persistTurnNotificationEnabled}
              onToggleTheme={onToggleTheme}
              theme={theme}
              sessionSummary={sessionSummary}
              toggleAgent={toggleAgent}
              agentConfigLoading={agentConfigLoading}
              agentConfigSaving={agentConfigSaving}
              openAgentSettings={openAgentSettings}
              activeSubagents={activeSubagents}
              agentConfigError={agentConfigError}
              activeAgentDef={activeAgentDef}
              activeAgentConfig={activeAgentConfig}
              settingsBusy={settingsBusy}
              updateAgentDraft={updateAgentDraft}
              activeAgentSettings={activeAgentSettings}
              guardianRuleSummary={guardianRuleSummary}
              floatingAgentSettings={floatingAgentSettings}
              toggleFloatingAgentSettings={toggleFloatingAgentSettings}
              loadAgentConfig={loadAgentConfig}
              setAgentConfigError={setAgentConfigError}
              saveAgentSettings={saveAgentSettings}
              interactionBusy={interactionBusy}
              projectItems={projectItems}
              activeProjectKey={activeProjectKey}
              selectProject={selectProject}
              threadItems={threadItems}
              activeThread={activeThread}
              viewThread={viewThread}
            />
          </div>
        ) : null}
        <div className="sidebar-footer">
          <button
            className="sidebar-collapse-btn"
            type="button"
            onClick={() => {
              if (isMobileLayout) {
                setIsSidebarOpen(false);
                return;
              }
              setIsSidebarCollapsed((current) => !current);
            }}
            aria-label={isMobileLayout ? "Collapse left panel" : isDesktopSidebarCollapsed ? "Expand left panel" : "Collapse left panel"}
            title={isMobileLayout ? "Collapse left panel" : isDesktopSidebarCollapsed ? "Expand left panel" : "Collapse left panel"}
          >
            <SidebarChevronIcon collapsed={isMobileLayout ? false : isDesktopSidebarCollapsed} />
          </button>
        </div>
      </aside>
      {isMobileLayout ? (
        <button
          className={`sidebar-backdrop ${isSidebarOpen ? "open" : ""}`}
          type="button"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close navigation menu"
        />
      ) : !isDesktopSidebarCollapsed ? (
        <div
          className={`sidebar-resizer ${isResizingSidebar ? "active" : ""}`}
          onMouseDown={() => setIsResizingSidebar(true)}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
        />
      ) : (
        <div className="sidebar-resizer sidebar-resizer-collapsed" aria-hidden="true" />
      )}
      </AppSidebarPresenter>
      <AppMainPresenter>
      <main className="main">
        {isMobileLayout ? (
          <div className="mobile-main-actions">
            <button
              className="menu-toggle icon-only"
              type="button"
              onClick={() => setIsSidebarOpen((current) => !current)}
              aria-label="Toggle navigation menu"
              aria-expanded={isSidebarOpen}
              aria-controls="app-sidebar"
            >
              <MenuIcon />
            </button>
          </div>
        ) : null}
        <FloatingGuardianSettingsPanel
          visible={floatingAgentSettings === "guardian"}
          settingsBusy={settingsBusy}
          floatingAgentConfig={floatingAgentConfig}
          floatingAgentSettings={floatingAgentSettings}
          guardianRulesEditor={guardianRulesEditor}
          setFloatingAgentSettings={setFloatingAgentSettings}
          setAgentConfigRawEditors={setAgentConfigRawEditors}
          loadAgentConfig={loadAgentConfig}
          saveAgentSettings={saveAgentSettings}
          setAgentConfigError={setAgentConfigError}
        />
        <AppCenterPanePresenter
          topTabs={
            <TopTabs
              projectTabs={projectTabs}
              activeProjectTabId={activeProjectTabId}
              projectTabStatusById={projectTabStatusById}
              onSelectProjectTab={(tabId) => {
                setActiveProjectTabId(tabId);
                if (isMobileLayout) {
                  setIsSidebarOpen(false);
                }
              }}
              onCloseProjectTab={closeProjectTab}
              threadTabs={threadTabsByProjectTabId[activeProjectTabId] || []}
              activeThread={activeThread}
              onSelectThread={viewThread}
              onCloseThread={(threadId) => closeThreadTab(activeProjectTabId, threadId)}
              onAddThread={() => startThread().catch(() => {})}
              disableAddThread={!activeProjectKey || interactionBusy}
            />
          }
          centerPane={
            <>
              <WorkspacePreviewOverlay
                workspacePreview={workspacePreview}
                isResizingWorkspacePreview={isResizingWorkspacePreview}
                isMobileLayout={isMobileLayout}
                workspacePreviewWidth={workspacePreviewWidth}
                workspacePreviewHeight={workspacePreviewHeight}
                workspacePreviewResizeRef={workspacePreviewResizeRef}
                setIsResizingWorkspacePreview={setIsResizingWorkspacePreview}
                setWorkspacePreview={setWorkspacePreview}
                resetWorkspacePreviewSize={resetWorkspacePreviewSize}
              />
              <div className="chat" ref={chatRef}>
                <ApprovalStack
                  approvalItems={approvalItems}
                  approvalBusyId={approvalBusyId}
                  onSubmitApproval={submitApproval}
                  onClose={() => setApprovalItems([])}
                />
                <ChatMessageFeed renderItems={renderItems} />
              </div>
              <AppComposerPresenter
                activityDetail={activityDetail}
                paletteOpen={paletteOpen}
                paletteRef={paletteRef}
                visiblePaletteItems={visiblePaletteItems}
                paletteWindowStart={paletteWindowStart}
                paletteSelectedIndex={paletteSelectedIndex}
                activeTokenType={activeToken?.type || ""}
                onApplyPaletteItem={applyPaletteItem}
                collaborationMode={collaborationMode}
                composerLocked={composerLocked}
                modeSwitchBusy={modeSwitchBusy}
                onToggleComposerMode={() => {
                  toggleComposerMode().catch(() => {});
                  focusComposer();
                }}
                inputRef={inputRef}
                input={input}
                onInputChange={onInputChange}
                onInputFocus={onInputFocus}
                onInputBlur={onInputBlur}
                onInputSelect={onInputSelect}
                onInputKeyDown={onInputKeyDown}
                status={status}
                onInterrupt={interrupt}
                onSendMessage={sendMessage}
                isCompactWorkspaceLayout={isCompactWorkspaceLayout}
                isWorkspacePanelOpen={isWorkspacePanelOpen}
                onToggleWorkspacePanel={() => setIsWorkspacePanelOpen((current) => !current)}
                onNewChat={() => startThread({ replaceCurrentTab: true }).catch(() => {})}
                interactionBusy={interactionBusy}
                StopIcon={StopIcon}
                SendIcon={SendIcon}
                FolderIcon={FolderIcon}
                NewChatIcon={NewChatIcon}
              />
            </>
          }
          isCompactWorkspaceLayout={isCompactWorkspaceLayout}
          isWorkspacePanelOpen={isWorkspacePanelOpen}
          workspacePanel={workspacePanel}
          isResizingWorkspacePanel={isResizingWorkspacePanel}
          onStartWorkspacePanelResize={(event) => {
            workspaceResizeRef.current = {
              startX: event.clientX,
              startWidth: workspacePanelWidth,
            };
            setIsResizingWorkspacePanel(true);
          }}
        />
      </main>
      </AppMainPresenter>
    </div>
    </AuthenticatedAppPresenter>
  );
}

export default AuthenticatedAppContainer;
