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
import ApprovalStack from "../../approvals/components/ApprovalStack";
import useApprovalFlow from "../../approvals/hooks/useApprovalFlow";
import ChatMessageFeed from "../../chat/components/ChatMessageFeed";
import { AGENT_CONFIG_DEFS } from "../../common/constants";
import { api } from "../../common/api";
import {
  ChevronIcon,
  FileIcon,
  FolderIcon,
  MenuIcon,
  NewChatIcon,
  RefreshIcon,
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
  normalizeWorkspacePath,
  statusClassName,
  statusPriority,
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

  const patchSessionAgent = (agentName, enabled) => {
    setSessionSummary((prev) => {
      if (!prev || !Array.isArray(prev.agents)) {
        return prev;
      }
      return {
        ...prev,
        agents: prev.agents.map((agent) =>
          agent.name === agentName ? { ...agent, enabled } : agent
        ),
      };
    });
  };

  const syncAgentConfig = (agentName, config, syncRulesEditor = true) => {
    setAgentConfigs((prev) => ({ ...prev, [agentName]: config }));
    if (agentName === "guardian" && syncRulesEditor) {
      setAgentConfigRawEditors((prev) => ({
        ...prev,
        [agentName]: formatGuardianRulesEditor(config),
      }));
    }
  };

  const loadAgentConfig = async (
    agentName,
    options: { syncRulesEditor?: boolean } = {}
  ) => {
    const { syncRulesEditor = true } = options;
    const def = AGENT_CONFIG_DEFS[agentName];
    if (!def) {
      return null;
    }
    setAgentConfigError("");
    setAgentConfigLoading(agentName);
    try {
      const config = await api(def.path);
      syncAgentConfig(agentName, config, syncRulesEditor);
      return config;
    } finally {
      setAgentConfigLoading((current) => (current === agentName ? "" : current));
    }
  };

  const buildAgentPayload = (
    agentName,
    draft,
    options: { includeRules?: boolean } = {}
  ) => {
    const { includeRules = false } = options;
    if (agentName !== "guardian") {
      return draft;
    }
    const payload = {
      enabled: !!draft.enabled,
      timeout_seconds: Number(draft.timeout_seconds ?? 20),
      failure_policy: String(draft.failure_policy ?? "manual_fallback"),
      explainability: String(draft.explainability ?? "decision_only"),
    };
    if (!includeRules) {
      return payload;
    }
    const rawRules = agentConfigRawEditors[agentName] ?? formatGuardianRulesEditor(draft);
    return { ...payload, rules_toml: rawRules };
  };

  const toggleAgent = async (agentName) => {
    const def = AGENT_CONFIG_DEFS[agentName];
    if (!def || agentConfigSaving || agentConfigLoading) {
      return;
    }
    setAgentConfigError("");
    setAgentConfigSaving(agentName);
    try {
      const current = agentConfigs[agentName] || (await loadAgentConfig(agentName));
      if (!current) {
        return;
      }
      const saved = await api(def.path, {
        method: "POST",
        body: JSON.stringify({ ...current, enabled: !current.enabled }),
      });
      setAgentConfigs((prev) => ({ ...prev, [agentName]: saved }));
      patchSessionAgent(agentName, !!saved.enabled);
    } catch (err) {
      setAgentConfigError(err.message || "Failed to update agent.");
    } finally {
      setAgentConfigSaving("");
    }
  };

  const openAgentSettings = async (agentName) => {
    const def = AGENT_CONFIG_DEFS[agentName];
    if (!def) {
      return;
    }
    if (activeAgentSettings === agentName) {
      setActiveAgentSettings("");
      setFloatingAgentSettings((current) => (current === agentName ? "" : current));
      setAgentConfigError("");
      return;
    }
    setActiveAgentSettings(agentName);
    if (agentName !== "guardian") {
      setFloatingAgentSettings("");
    }
    if (agentConfigs[agentName]) {
      if (agentName === "guardian" && !agentConfigRawEditors[agentName]) {
        setAgentConfigRawEditors((prev) => ({
          ...prev,
          [agentName]: formatGuardianRulesEditor(agentConfigs[agentName]),
        }));
      }
      setAgentConfigError("");
      return;
    }
    try {
      await loadAgentConfig(agentName);
    } catch (err) {
      setAgentConfigError(err.message || "Failed to load settings.");
    }
  };

  const toggleFloatingAgentSettings = (agentName) => {
    if (!agentName || activeAgentSettings !== agentName) {
      return;
    }
    setFloatingAgentSettings((current) => (current === agentName ? "" : agentName));
    setAgentConfigError("");
  };

  const updateAgentDraft = (agentName, key, value) => {
    setAgentConfigs((prev) => ({
      ...prev,
      [agentName]: {
        ...(prev[agentName] || {}),
        [key]: value,
      },
    }));
  };

  const saveAgentSettings = async (
    agentName = activeAgentSettings,
    options: { includeRules?: boolean } = {}
  ) => {
    const { includeRules = agentName === activeAgentSettings && agentName === "guardian" } = options;
    const def = AGENT_CONFIG_DEFS[agentName];
    const draft = agentConfigs[agentName];
    if (!def || !draft || agentConfigSaving || agentConfigLoading) {
      return;
    }
    setAgentConfigError("");
    setAgentConfigSaving(agentName);
    try {
      const payload = buildAgentPayload(agentName, draft, { includeRules });
      const saved = await api(def.path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      syncAgentConfig(agentName, saved, includeRules);
      patchSessionAgent(agentName, !!saved.enabled);
    } catch (err) {
      setAgentConfigError(err.message || "Failed to save settings.");
    } finally {
      setAgentConfigSaving("");
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) {
      return;
    }
    const text = input.trim();
    const activeThreadId = resolveCurrentThreadId();
    if (activeThreadId) {
      if (activeThreadId !== normalizeThreadId(activeThread) && activeProjectTabId) {
        setActiveThreadForProjectTab(activeProjectTabId, activeThreadId);
      }
      updateThreadUi(activeThreadId, { input: "" });
    }
    pendingComposerFocusRef.current = true;
    setInputForActiveThread("");
    if (text.startsWith("/")) {
      await runCommand(text);
      return;
    }
    const messageThreadId = activeThreadId;
    appendMessageToThread(messageThreadId, { role: "user", text, turnId: "" });
    setStatusForThread(messageThreadId, "running");
    try {
      const result = await api("/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          text,
          thread_id: messageThreadId || undefined,
          project_key: activeProjectKey || undefined,
        }),
      });
      const resultTurnId = typeof result?.turn_id === "string" ? result.turn_id : "";
      const resultThreadId = normalizeThreadId(result?.thread_id) || messageThreadId;
      if (resultThreadId && activeProjectTabId) {
        const threadInfo = threadItems.find((item) => normalizeThreadId(item?.id) === resultThreadId);
        openThreadInProjectTab(activeProjectTabId, {
          id: resultThreadId,
          title: threadInfo?.title || resultThreadId,
        });
      }
      if (resultTurnId && resultThreadId) {
        turnThreadIdRef.current[resultTurnId] = resultThreadId;
      }
      if (result.local_command) {
        const responseThreadId = resultThreadId;
        appendMessageToThread(responseThreadId, {
          role: "assistant",
          text: result.output || "",
          threadId: responseThreadId,
          turnId: resultTurnId,
        });
        setStatusForThread(responseThreadId, "idle");
        loadSessionSummary().catch(() => {});
      }
    } catch (err) {
      setStatusForThread(messageThreadId, "idle");
      appendMessageToThread(messageThreadId, {
        role: "system",
        text: err.message || "Request failed.",
        threadId: messageThreadId,
        turnId: "",
        streaming: false,
      });
      loadSessionSummary().catch(() => {});
    }
  };

  const toggleComposerMode = async () => {
    if (status === "running" || modeSwitchBusy) {
      return;
    }
    setModeSwitchBusy(true);
    try {
      const result = await api("/api/command", {
        method: "POST",
        body: JSON.stringify({ command_line: "/mode toggle" }),
      });
      const nextMode = normalizeCollaborationMode(result?.meta?.collaboration_mode);
      setCollaborationMode(nextMode);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: err.message || "Failed to switch mode.",
          threadId: normalizeThreadId(activeThread),
          turnId: "",
          streaming: false,
        },
      ]);
    } finally {
      setModeSwitchBusy(false);
    }
  };

  const focusComposer = (cursor = null) => {
    queueMicrotask(() => {
      const el = inputRef.current;
      if (!el || el.disabled) {
        return;
      }
      el.focus();
      if (typeof cursor === "number") {
        el.selectionStart = cursor;
        el.selectionEnd = cursor;
        composerSelectionRef.current = { start: cursor, end: cursor };
      }
    });
  };

  const rememberComposerSelection = (el) => {
    if (!el) {
      return;
    }
    composerSelectionRef.current = {
      start: typeof el.selectionStart === "number" ? el.selectionStart : null,
      end: typeof el.selectionEnd === "number" ? el.selectionEnd : null,
    };
  };

  const autoResizeInput = () => {
    const el = inputRef.current;
    if (!el) {
      return;
    }
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 240);
    el.style.height = `${Math.max(40, next)}px`;
  };

  const interrupt = async () => {
    const activeThreadId = normalizeThreadId(activeThread);
    await api("/api/threads/interrupt", {
      method: "POST",
      body: JSON.stringify({ thread_id: activeThreadId || undefined }),
    });
    setStatusForThread(activeThreadId, "idle");
  };

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

  useEffect(() => {
    const activeThreadId = normalizeThreadId(activeThreadRef.current);
    const preview = (Array.isArray(messages) ? messages : []).slice(-5).map((m) => ({
      role: m?.role || "",
      threadId: m?.threadId || "",
      turnId: m?.turnId || "",
      itemId: m?.itemId || "",
      kind: m?.kind || "",
      streaming: !!m?.streaming,
      text: typeof m?.text === "string" ? m.text.slice(0, 120) : "",
      visibleInCurrentThread:
        !m?.threadId || normalizeThreadId(m.threadId) === activeThreadId,
    }));
    debugLog("[CHAT-RENDER]", {
      activeThreadId,
      messageCount: Array.isArray(messages) ? messages.length : 0,
      renderItemCount: Array.isArray(renderItems) ? renderItems.length : 0,
      tailMessages: preview,
    });
  }, [messages, renderItems, activeThreadRef]);

  useEffect(() => {
    if (!chatRef.current) {
      return;
    }
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!chatRef.current) {
      return;
    }
    const panels = chatRef.current.querySelectorAll(".file-change-panel-scroll");
    panels.forEach((panel) => {
      panel.scrollTop = panel.scrollHeight;
    });
  }, [renderItems]);

  useEffect(() => {
    if (status === "running" || !pendingComposerFocusRef.current) {
      return;
    }
    pendingComposerFocusRef.current = false;
    focusComposer(input.length);
  }, [input.length, status]);

  useEffect(() => {
    autoResizeInput();
  }, [input]);
  useEffect(() => {
    if (!composerFocusWantedRef.current || typeof window === "undefined") {
      return undefined;
    }
    const el = inputRef.current;
    if (!el || el.disabled) {
      return undefined;
    }
    if (document.activeElement === el) {
      rememberComposerSelection(el);
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      if (!composerFocusWantedRef.current) {
        return;
      }
      const current = inputRef.current;
      if (!current || current.disabled || document.activeElement === current) {
        return;
      }
      current.focus();
      const { start, end } = composerSelectionRef.current;
      if (typeof start === "number" && typeof end === "number") {
        current.selectionStart = start;
        current.selectionEnd = end;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [input, paletteOpen, paletteSelectedIndex]);

  useEffect(() => {
    setPaletteSelectedIndex(0);
  }, [activeToken?.type, activeToken?.query]);
  useEffect(() => {
    loadThreads({ projectKey: activeProjectKey, projectTabId: activeProjectTabId }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!activeProjectTabId) {
      return;
    }
    const selectedThreadId = resolveCurrentThreadId(activeProjectTabId);
    setActiveThreadForProjectTab(activeProjectTabId, selectedThreadId);
    restoreWorkspaceForThread(selectedThreadId);
    if (selectedThreadId) {
      viewThread(selectedThreadId).catch(() => {});
    } else {
      setMessages([]);
    }
    loadSessionSummary().catch(() => {});
    loadThreads({ projectKey: activeProjectKey, projectTabId: activeProjectTabId, ensureDefaultTab: false }).catch(() => {});
  }, [activeProjectTabId]);
  useEffect(() => {
    if (paletteSelectedIndex < paletteItems.length) {
      return;
    }
    setPaletteSelectedIndex(0);
  }, [paletteItems.length, paletteSelectedIndex]);
  useEffect(() => {
    if (!paletteOpen || !paletteRef.current) {
      return;
    }
    const container = paletteRef.current;
    const active = container.querySelector(".slash-item.active");
    if (!active) {
      return;
    }
    active.scrollIntoView({ block: "nearest" });
  }, [paletteOpen, paletteSelectedIndex, visiblePaletteItems.length]);
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
  useEffect(() => {
    if (!activeToken || activeToken.type !== "project") {
      setProjectSuggestions([]);
      return;
    }
    const prefix = activeToken.query || "";
    {
      const query = new URLSearchParams({ prefix, limit: "200" });
      const ctx = workspaceContextQuery();
      if (ctx) {
        const ctxParams = new URLSearchParams(ctx);
        ctxParams.forEach((value, key) => query.set(key, value));
      }
      api(`/api/workspace/suggestions?${query.toString()}`)
      .then((result) => {
        const items = Array.isArray(result.items) ? result.items : [];
        setProjectSuggestions(items.filter((v) => typeof v === "string" && v));
      })
      .catch(() => {
        setProjectSuggestions([]);
      });
    }
  }, [activeToken?.type, activeToken?.query]);
  useEffect(() => {
    if (floatingAgentSettings && floatingAgentSettings !== activeAgentSettings) {
      setFloatingAgentSettings("");
    }
  }, [activeAgentSettings, floatingAgentSettings]);
  useEffect(() => {
    if (!isProjectModeModalOpen || typeof window === "undefined") {
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setPendingProjectTarget("");
        setIsProjectModeModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isProjectModeModalOpen]);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
    startThreadRef.current = startThread;
    closeThreadTabRef.current = closeThreadTab;
    viewThreadRef.current = viewThread;
    selectProjectRef.current = selectProject;
    focusComposerRef.current = focusComposer;
    setInputForActiveThreadRef.current = setInputForActiveThread;
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

  const applyPaletteItem = (item) => {
    if (!activeToken) {
      return;
    }
    let next = input;
    let cursor = input.length;
    if (activeToken.type === "slash") {
      next = `${item} `;
      cursor = next.length;
    } else if (activeToken.type === "project") {
      next = `${input.slice(0, activeToken.start)}@${item}${input.slice(activeToken.end)}`;
      cursor = activeToken.start + item.length + 1;
    } else {
      next = `${input.slice(0, activeToken.start)}$${item}${input.slice(activeToken.end)}`;
      cursor = activeToken.start + item.length + 1;
    }
    setInputForActiveThread(next);
    focusComposer(cursor);
  };

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

  function upsertPlanMessage(mode, payload) {
    const itemId = typeof payload?.item_id === "string" ? payload.item_id : "";
    const text = typeof payload?.text === "string" ? payload.text : "";
    if (!itemId || !text) {
      return;
    }
    const targetThreadId = normalizeThreadId(payload?.thread_id);
    applyMessageMutationForThread(targetThreadId, (prev) => {
      const next = [...prev];
      const existingIndex = next.findIndex(
        (message) => message.kind === "plan" && message.itemId === itemId
      );
      const streaming = mode !== "final";
      if (existingIndex >= 0) {
        const existing = next[existingIndex];
        next[existingIndex] = {
          ...existing,
          role: "assistant",
          kind: "plan",
          itemId,
          threadId: normalizeThreadId(payload?.thread_id),
          turnId: typeof payload?.turn_id === "string" ? payload.turn_id : existing?.turnId || "",
          text: mode === "append" ? `${existing.text || ""}${text}` : text,
          streaming,
        };
        return next;
      }
      next.push({
        role: "assistant",
        kind: "plan",
        itemId,
        threadId: normalizeThreadId(payload?.thread_id),
        turnId: typeof payload?.turn_id === "string" ? payload.turn_id : "",
        text,
        streaming,
      });
      return next;
    });
  };

  function upsertPlanChecklist(payload) {
    const text = formatPlanChecklistText(payload?.explanation, payload?.plan);
    const turnId = typeof payload?.turn_id === "string" ? payload.turn_id : "";
    if (!text || !turnId) {
      return;
    }
    const targetThreadId = normalizeThreadId(payload?.thread_id);
    applyMessageMutationForThread(targetThreadId, (prev) => {
      const next = [...prev];
      const existingIndex = next.findIndex(
        (message) => message.kind === "plan_checklist" && message.turnId === turnId
      );
      const value = {
        role: "system",
        kind: "plan_checklist",
        threadId: normalizeThreadId(payload?.thread_id),
        turnId,
        text,
        plan: Array.isArray(payload?.plan) ? payload.plan : [],
        explanation: typeof payload?.explanation === "string" ? payload.explanation : "",
        streaming: false,
      };
      if (existingIndex >= 0) {
        next[existingIndex] = { ...next[existingIndex], ...value };
        return next;
      }
      next.push(value);
      return next;
    });
  };

  function appendReasoningStatus(payload) {
    const itemId = typeof payload?.item_id === "string" ? payload.item_id : "";
    if (!itemId) {
      return;
    }
    const existing = reasoningStateRef.current[itemId] || {
      itemId,
      turnId: typeof payload?.turn_id === "string" ? payload.turn_id : "",
      threadId: normalizeThreadId(payload?.thread_id),
      summary: "",
      raw: "",
    };
    if (payload?.section_break && existing.summary && !existing.summary.endsWith("\n\n")) {
      existing.summary += "\n\n";
    }
    if (payload?.raw) {
      if (typeof payload?.delta === "string" && payload.delta) {
        existing.raw += payload.delta;
      }
    } else if (typeof payload?.delta === "string" && payload.delta) {
      existing.summary += payload.delta;
    }
    if (!existing.turnId && typeof payload?.turn_id === "string") {
      existing.turnId = payload.turn_id;
    }
    if (!existing.threadId) {
      existing.threadId = normalizeThreadId(payload?.thread_id);
    }
    reasoningStateRef.current[itemId] = existing;
    const detail = summarizeReasoningStatus(existing.summary) || "Reasoning";
    const targetThreadId = normalizeThreadId(payload?.thread_id) || existing.threadId || "";
    setActivityDetailForThread(targetThreadId, detail);
  };

  function completeReasoning(payload) {
    const itemId = typeof payload?.item_id === "string" ? payload.item_id : "";
    const existing = (itemId && reasoningStateRef.current[itemId]) || null;
    const summaryText = Array.isArray(payload?.summary_text)
      ? payload.summary_text.filter((entry) => typeof entry === "string" && entry.trim())
      : [];
    const rawContent = Array.isArray(payload?.raw_content)
      ? payload.raw_content.filter((entry) => typeof entry === "string" && entry.trim())
      : [];
    const summary = (summaryText.length ? summaryText.join("\n\n") : existing?.summary || "").trim();
    const raw = (rawContent.length ? rawContent.join("\n\n") : existing?.raw || "").trim();
    if (itemId) {
      delete reasoningStateRef.current[itemId];
    }
    const targetThreadId = normalizeThreadId(payload?.thread_id) || existing?.threadId || "";
    setActivityDetailForThread(targetThreadId, "");
    if (!summary) {
      return;
    }
    applyMessageMutationForThread(targetThreadId, (prev) => [
      ...prev,
      {
        role: "system",
        kind: "reasoning",
        threadId: targetThreadId,
        turnId: typeof payload?.turn_id === "string" ? payload.turn_id : existing?.turnId || "",
        itemId,
        text: summary,
        rawReasoning: raw,
        streaming: false,
      },
    ]);
  };

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
  const workspaceStatusItems = useMemo(
    () => (workspaceStatus && typeof workspaceStatus.items === "object" ? workspaceStatus.items : {}),
    [workspaceStatus]
  );
  const workspaceDirectoryStatus = useMemo(() => {
    const next = {};
    for (const [path, value] of Object.entries(workspaceStatusItems)) {
      const normalizedPath = normalizeWorkspacePath(path);
      const code = value?.code || "";
      if (!normalizedPath || !code) {
        continue;
      }
      const parts = normalizedPath.split("/");
      parts.pop();
      let current = "";
      for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        const existing = next[current] || "";
        if (statusPriority(code) > statusPriority(existing)) {
          next[current] = code;
        }
      }
    }
    return next;
  }, [workspaceStatusItems]);
  const deletedWorkspaceEntries = Object.entries(workspaceStatusItems)
    .filter(([path, value]) => value?.code === "D" && !workspaceTree[""]?.some((item) => item.path === path))
    .sort((a, b) => a[0].localeCompare(b[0]));

  const getWorkspaceTreeChildren = (item) => {
    if (!item || item.type !== "directory") {
      return [];
    }
    const itemPath = normalizeWorkspacePath(item.path);
    const cachedChildren = Array.isArray(workspaceTree[itemPath]) ? workspaceTree[itemPath] : [];
    if (cachedChildren.length) {
      return cachedChildren;
    }
    return Array.isArray(item.children) ? item.children : [];
  };

  const collectCompactWorkspaceEntry = (item) => {
    const segments = [];
    let currentItem = item;
    let currentChildren = getWorkspaceTreeChildren(currentItem);

    while (currentItem && currentItem.type === "directory") {
      segments.push(currentItem);
      if (!Array.isArray(currentChildren) || currentChildren.length !== 1) {
        break;
      }
      const nextItem = currentChildren[0];
      if (!nextItem || nextItem.type !== "directory") {
        break;
      }
      currentItem = nextItem;
      currentChildren = getWorkspaceTreeChildren(currentItem);
    }

    const leafItem = segments[segments.length - 1] || item;
    const leafPath = normalizeWorkspacePath(leafItem.path);
    const leafChildren = getWorkspaceTreeChildren(leafItem);
    const statusCode = segments.reduce((best, segment) => {
      const segmentPath = normalizeWorkspacePath(segment.path);
      const segmentCode = workspaceDirectoryStatus[segmentPath] || workspaceStatusItems[segmentPath]?.code || "";
      return statusPriority(segmentCode) > statusPriority(best) ? segmentCode : best;
    }, "");

    return {
      leafItem,
      leafPath,
      leafChildren,
      segments,
      statusCode,
      label: segments.map((segment) => segment.name).join("/"),
      isExpanded: !!expandedWorkspaceDirs[leafPath],
    };
  };

  const copyWorkspacePathToClipboard = useCallback(async (path) => {
    const text = normalizeWorkspacePath(path);
    if (!text) {
      return;
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      showToast(`Copied ${text}`, "success");
    } catch (_err) {
      showToast("Failed to copy path.", "error");
    }
  }, [showToast]);

  const renderWorkspaceTree = (path = "", depth = 0) => {
    const normalizedPath = normalizeWorkspacePath(path);
    const items = Array.isArray(workspaceTree[normalizedPath]) ? workspaceTree[normalizedPath] : [];
    if (!items.length && normalizedPath) {
      return null;
    }
    return items.map((item) => {
      const itemPath = normalizeWorkspacePath(item.path);
      const isDirectory = item.type === "directory";
      if (isDirectory) {
        const compactEntry = collectCompactWorkspaceEntry(item);
        const hasChildren = !!compactEntry.leafItem.has_children || compactEntry.leafChildren.length > 0;
        const isSelected = workspacePreview?.path === compactEntry.leafPath;
        return (
          <div key={compactEntry.leafPath} className="workspace-tree-node">
            <button
              type="button"
              className={`workspace-tree-item directory ${compactEntry.isExpanded ? "expanded" : ""} ${isSelected ? "selected" : ""} ${statusClassName(compactEntry.statusCode)}`}
              style={{ paddingLeft: `${12 + depth * 16}px` }}
              title={compactEntry.leafPath}
              onClick={() => {
                toggleWorkspaceDirectory(compactEntry.leafPath);
              }}
              onKeyDown={(event) => {
                const ctrlKey = event.metaKey || event.ctrlKey;
                if (ctrlKey && event.key.toLowerCase() === "c") {
                  event.preventDefault();
                  event.stopPropagation();
                  copyWorkspacePathToClipboard(compactEntry.leafPath).catch(() => {});
                }
              }}
            >
              <span className="workspace-tree-icon caret">
                {hasChildren ? <ChevronIcon expanded={compactEntry.isExpanded} /> : null}
              </span>
              <span className="workspace-tree-icon glyph">
                <FolderIcon open={compactEntry.isExpanded} />
              </span>
              <span className="workspace-tree-label workspace-tree-label-compact">{compactEntry.label}</span>
              {compactEntry.statusCode ? <span className="workspace-tree-badge">{compactEntry.statusCode}</span> : null}
            </button>
            {compactEntry.isExpanded ? renderWorkspaceTree(compactEntry.leafPath, depth + compactEntry.segments.length) : null}
          </div>
        );
      }
      const statusCode = workspaceStatusItems[itemPath]?.code || "";
      const isSelected = workspacePreview?.path === itemPath;
      return (
        <div key={itemPath} className="workspace-tree-node">
          <button
            type="button"
            className={`workspace-tree-item file ${isSelected ? "selected" : ""} ${statusClassName(statusCode)}`}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
            title={itemPath}
            onClick={() => {
              openWorkspaceFile(itemPath, statusCode).catch(() => {});
            }}
            onKeyDown={(event) => {
              const ctrlKey = event.metaKey || event.ctrlKey;
              if (ctrlKey && event.key.toLowerCase() === "c") {
                event.preventDefault();
                event.stopPropagation();
                copyWorkspacePathToClipboard(itemPath).catch(() => {});
              }
            }}
          >
            <span className="workspace-tree-icon caret" />
            <span className="workspace-tree-icon glyph"><FileIcon /></span>
            <span className="workspace-tree-label">{item.name}</span>
            {statusCode ? <span className="workspace-tree-badge">{statusCode}</span> : null}
          </button>
        </div>
      );
    });
  };
  const workspacePanelStyle = getWorkspacePanelStyle(isCompactWorkspaceLayout, workspacePanelWidth);
  const workspacePanel = (
    <aside
      className={`workspace-panel ${isCompactWorkspaceLayout ? "compact" : "desktop"} ${isWorkspacePanelOpen ? "open" : ""}`}
      style={workspacePanelStyle}
    >
      <div className="workspace-panel-head">
        <div>
          <div className="workspace-panel-title">Workspace Files</div>
          <div className="workspace-panel-subtitle">{workspaceRootLabel}</div>
        </div>
        <button
          className="workspace-refresh"
          type="button"
          onClick={() => {
            refreshWorkspaceBrowser().catch((err) => {
              setWorkspaceError(err.message || "Failed to refresh workspace tree.");
            });
          }}
          aria-label="Refresh workspace browser"
          title="Refresh workspace browser"
        >
          <RefreshIcon />
        </button>
      </div>
      {workspaceError ? <div className="workspace-panel-state">{workspaceError}</div> : null}
      {!(activeProjectTab?.path || sessionSummary?.workspace) ? (
        <div className="workspace-panel-state">Select a workspace to browse files.</div>
      ) : null}
      {activeProjectTab?.path || sessionSummary?.workspace ? (
        <div className="workspace-tree">
          {deletedWorkspaceEntries.length ? (
            <div className="workspace-tree-group">
              <div className="workspace-tree-group-label">Deleted</div>
              {deletedWorkspaceEntries.map(([path, value]) => (
                <button
                  key={`deleted:${path}`}
                  type="button"
                  className="workspace-tree-item file deleted"
                  title={path}
                  onClick={() => openWorkspaceFile(path, value?.code || "D").catch(() => {})}
                  onKeyDown={(event) => {
                    const ctrlKey = event.metaKey || event.ctrlKey;
                    if (ctrlKey && event.key.toLowerCase() === "c") {
                      event.preventDefault();
                      event.stopPropagation();
                      copyWorkspacePathToClipboard(path).catch(() => {});
                    }
                  }}
                >
                  <span className="workspace-tree-icon caret" />
                  <span className="workspace-tree-icon glyph"><FileIcon /></span>
                  <span className="workspace-tree-label">{path}</span>
                  <span className="workspace-tree-badge">{value?.code || "D"}</span>
                </button>
              ))}
            </div>
          ) : null}
          {renderWorkspaceTree("", 0)}
          {Array.isArray(workspaceTree[""]) && workspaceTree[""].length ? null : (
            <div className="workspace-panel-state">No files available.</div>
          )}
        </div>
      ) : null}
    </aside>
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







