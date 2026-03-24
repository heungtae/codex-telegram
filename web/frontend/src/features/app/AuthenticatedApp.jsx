import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ApprovalStack from "../approvals/components/ApprovalStack";
import ChatMessageFeed from "../chat/components/ChatMessageFeed";
import { AGENT_CONFIG_DEFS } from "../common/constants";
import { api } from "../common/api";
import {
  ChevronIcon,
  FileIcon,
  FolderIcon,
  MenuIcon,
  NewChatIcon,
  NotificationIcon,
  RefreshIcon,
  SaveIcon,
  SendIcon,
  SettingsIcon,
  SidebarChevronIcon,
  StopIcon,
  ThemeIcon,
} from "../common/components/Icons";
import { persistTurnNotificationEnabled, readTurnNotificationEnabled } from "../common/theme";
import {
  basename,
  buildProjectTabId,
  formatGuardianRulesEditor,
  formatPlanChecklistText,
  formatWebSearchAction,
  groupMessagesForRender,
  normalizeThreadId,
  normalizeWorkspacePath,
  statusClassName,
  statusPriority,
  summarizeReasoningStatus,
} from "../common/utils";
import TopTabs from "../tabs/components/TopTabs";
import useThreadScopedState from "../thread/hooks/useThreadScopedState";
import WorkspacePreviewPanel from "../workspace/components/WorkspacePreviewPanel";
import useWorkspaceBrowser from "../workspace/hooks/useWorkspaceBrowser";

function AuthenticatedApp({ me, theme, onToggleTheme }) {
  const PALETTE_LIMIT = 10;
  const SIDEBAR_MIN = 260;
  const SIDEBAR_MAX = 620;
  const SIDEBAR_COLLAPSED_WIDTH = 44;
  const WORKSPACE_PANEL_MIN = 280;
  const WORKSPACE_PANEL_MAX = 720;
  const MOBILE_BREAKPOINT = 900;
  const WORKSPACE_PANEL_BREAKPOINT = 1200;
  const [projectTabs, setProjectTabs] = useState([]);
  const [activeProjectTabId, setActiveProjectTabId] = useState("");
  const [threadTabsByProjectTabId, setThreadTabsByProjectTabId] = useState({});
  const [activeThreadTabIdByProjectTabId, setActiveThreadTabIdByProjectTabId] = useState({});
  const [threadProjectTabIdByThreadId, setThreadProjectTabIdByThreadId] = useState({});
  const [activeThread, setActiveThread] = useState("");
  const [threadItems, setThreadItems] = useState([]);
  const [projectItems, setProjectItems] = useState([]);
  const [projectSuggestions, setProjectSuggestions] = useState([]);
  const [skillSuggestions, setSkillSuggestions] = useState([]);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [collaborationMode, setCollaborationMode] = useState("build");
  const [modeSwitchBusy, setModeSwitchBusy] = useState(false);
  const [approvalItems, setApprovalItems] = useState([]);
  const [approvalBusyId, setApprovalBusyId] = useState(null);
  const [agentConfigs, setAgentConfigs] = useState({});
  const [agentConfigRawEditors, setAgentConfigRawEditors] = useState({});
  const [activeAgentSettings, setActiveAgentSettings] = useState("");
  const [floatingAgentSettings, setFloatingAgentSettings] = useState("");
  const [agentConfigLoading, setAgentConfigLoading] = useState("");
  const [agentConfigSaving, setAgentConfigSaving] = useState("");
  const [agentConfigError, setAgentConfigError] = useState("");
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
  const [paletteSelectedIndex, setPaletteSelectedIndex] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [workspacePanelWidth, setWorkspacePanelWidth] = useState(320);
  const [isResizingWorkspacePanel, setIsResizingWorkspacePanel] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= MOBILE_BREAKPOINT : false
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCompactWorkspaceLayout, setIsCompactWorkspaceLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= WORKSPACE_PANEL_BREAKPOINT : false
  );
  const [isWorkspacePanelOpen, setIsWorkspacePanelOpen] = useState(false);
  const [isProjectModeModalOpen, setIsProjectModeModalOpen] = useState(false);
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
  const [shortcutModalPage, setShortcutModalPage] = useState("main");
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [pendingProjectTarget, setPendingProjectTarget] = useState("");
  const [turnNotificationEnabled, setTurnNotificationEnabled] = useState(() => readTurnNotificationEnabled());
  const debugLoggingEnabled =
    (typeof me?.logging_level === "string" && me.logging_level.toUpperCase() === "DEBUG") ||
    me?.debug_logging === true;
  const debugLog = (...args) => {
    if (debugLoggingEnabled) {
      console.log(...args);
    }
  };
  const debugError = (...args) => {
    if (debugLoggingEnabled) {
      console.error(...args);
    }
  };
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
  const {
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
    loadWorkspaceTree,
    loadWorkspaceStatus,
    openWorkspaceFile,
    toggleWorkspaceDirectory,
  } = useWorkspaceBrowser({
    activeThread,
    activeProjectTabId,
    activeProjectKey: activeProjectTabSnapshot?.key || "",
    threadProjectTabIdByThreadId,
    activeProjectTabPath: activeProjectTabSnapshot?.path || "",
    sessionWorkspace: sessionSummary?.workspace || "",
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
  const activeToken = useMemo(() => {
    if (input.startsWith("/")) {
      const commandToken = input.slice(1);
      if (!commandToken || /\s/.test(commandToken)) {
        return null;
      }
      return {
        type: "slash",
        query: commandToken.toLowerCase(),
        start: 0,
        end: input.length,
      };
    }
    const lastToken = input.split(/\s+/).pop() || "";
    const match = lastToken.match(/^([@$])([^\s]*)$/);
    if (!match) {
      return null;
    }
    const marker = match[1];
    const typed = match[2] || "";
    const end = input.length;
    const start = end - lastToken.length;
    return {
      type: marker === "@" ? "project" : "skill",
      query: typed.toLowerCase(),
      start,
      end,
    };
  }, [input]);
  const paletteItems = useMemo(() => {
    if (!activeToken) {
      return [];
    }
    const query = activeToken.query;
    if (activeToken.type === "slash") {
      if (!query) {
        return slashCommands;
      }
      return slashCommands.filter((cmd) => cmd.toLowerCase().includes(`/${query}`));
    }
    if (activeToken.type === "project") {
      return projectSuggestions;
    }
    if (!query) {
      return skillSuggestions;
    }
    return skillSuggestions.filter((name) => name.toLowerCase().includes(query));
  }, [activeToken, projectSuggestions, skillSuggestions, slashCommands]);
  const paletteOpen = paletteItems.length > 0;
  const paletteWindowStart = useMemo(
    () => Math.floor(paletteSelectedIndex / PALETTE_LIMIT) * PALETTE_LIMIT,
    [paletteSelectedIndex]
  );
  const visiblePaletteItems = useMemo(
    () => paletteItems.slice(paletteWindowStart, paletteWindowStart + PALETTE_LIMIT),
    [paletteItems, paletteWindowStart]
  );
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

  const upsertProjectTab = (project, options = {}) => {
    const forceNew = !!options.forceNew;
    const key = typeof project?.key === "string" ? project.key : "";
    if (!key) {
      return "";
    }
    const baseTabId = buildProjectTabId(key);
    const tabId = forceNew ? `${baseTabId}:${++projectTabSequenceRef.current}` : baseTabId;
    const tab = {
      id: tabId,
      key,
      name: typeof project?.name === "string" && project.name ? project.name : key,
      path: typeof project?.path === "string" ? project.path : "",
    };
    setProjectTabs((prev) => {
      const index = prev.findIndex((item) => item.id === tabId);
      if (index >= 0) {
        const next = [...prev];
        next[index] = { ...next[index], ...tab };
        return next;
      }
      return [...prev, tab];
    });
    return tabId;
  };

  const openThreadInProjectTab = (projectTabId, thread) => {
    const threadId = normalizeThreadId(thread?.id);
    if (!projectTabId || !threadId) {
      return "";
    }
    const title = typeof thread?.title === "string" && thread.title ? thread.title : threadId;
    setThreadTabsByProjectTabId((prev) => {
      const rows = Array.isArray(prev[projectTabId]) ? prev[projectTabId] : [];
      const existing = rows.find((row) => row.id === threadId);
      if (existing) {
        return prev;
      }
      return {
        ...prev,
        [projectTabId]: [...rows, { id: threadId, title, status: "idle", hasUnreadCompletion: false }],
      };
    });
    setThreadProjectTabIdByThreadId((prev) => ({ ...prev, [threadId]: projectTabId }));
    ensureWorkspaceBucket(threadId);
    setActiveThreadForProjectTab(projectTabId, threadId);
    return threadId;
  };

  const setActiveThreadForProjectTab = (projectTabId, threadId) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    setActiveThreadTabIdByProjectTabId((prev) => ({ ...prev, [projectTabId]: normalizedThreadId }));
    if (projectTabId === activeProjectTabId) {
      setActiveThread(normalizedThreadId);
    }
  };

  const updateThreadTabState = (threadId, patch) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    if (!normalizedThreadId) {
      return;
    }
    const projectTabId = threadProjectTabIdByThreadIdRef.current[normalizedThreadId];
    if (!projectTabId) {
      return;
    }
    setThreadTabsByProjectTabId((prev) => {
      const rows = Array.isArray(prev[projectTabId]) ? prev[projectTabId] : [];
      const nextRows = rows.map((row) => (
        row.id === normalizedThreadId ? { ...row, ...patch } : row
      ));
      return { ...prev, [projectTabId]: nextRows };
    });
  };

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

  const closeProjectTab = (projectTabId) => {
    if (!projectTabId) {
      return;
    }
    const existingTabs = projectTabs;
    const index = existingTabs.findIndex((tab) => tab.id === projectTabId);
    const fallback = index > 0 ? existingTabs[index - 1] : existingTabs[index + 1];
    setProjectTabs((prev) => prev.filter((tab) => tab.id !== projectTabId));
    setThreadTabsByProjectTabId((prev) => {
      const next = { ...prev };
      delete next[projectTabId];
      return next;
    });
    setActiveThreadTabIdByProjectTabId((prev) => {
      const next = { ...prev };
      delete next[projectTabId];
      return next;
    });
    const ownedThreads = Array.isArray(threadTabsByProjectTabId[projectTabId])
      ? threadTabsByProjectTabId[projectTabId].map((row) => normalizeThreadId(row.id)).filter(Boolean)
      : [];
    ownedThreads.forEach((threadId) => removeWorkspaceBucket(threadId));
    setThreadProjectTabIdByThreadId((prev) => {
      const next = { ...prev };
      Object.entries(next).forEach(([threadId, tabId]) => {
        if (tabId === projectTabId) {
          delete next[threadId];
        }
      });
      return next;
    });
    if (activeProjectTabId === projectTabId) {
      setActiveProjectTabId(fallback?.id || "");
      setActiveThread(fallback ? normalizeThreadId(activeThreadTabIdByProjectTabId[fallback.id]) : "");
      setMessages([]);
    }
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
  };

  const loadThreads = async (options = {}) => {
    const projectKey = typeof options.projectKey === "string" ? options.projectKey : (activeProjectKey || "");
    const projectTabId = typeof options.projectTabId === "string" ? options.projectTabId : (activeProjectTabId || "");
    const ensureDefaultTab = !!options.ensureDefaultTab;
    const resetThreadTabs = !!options.resetThreadTabs;
    const configuredThreadsLimit = Number.parseInt(String(me?.threads_list_limit ?? "20"), 10);
    const threadsLimit = Number.isFinite(configuredThreadsLimit)
      ? Math.max(1, Math.min(100, configuredThreadsLimit))
      : 20;
    const query = new URLSearchParams({ limit: String(threadsLimit), offset: "0", archived: "false" });
    if (projectKey) {
      query.set("project_key", projectKey);
    }
    const summaries = await api(`/api/threads/summaries?${query.toString()}`);
    const items = Array.isArray(summaries.items) ? summaries.items : [];
    if (!projectTabId || projectTabId === activeProjectTabId) {
      setThreadItems(items);
    }
    if (ensureDefaultTab && projectTabId) {
      const opened = resetThreadTabs
        ? []
        : (Array.isArray(threadTabsByProjectTabId[projectTabId]) ? threadTabsByProjectTabId[projectTabId] : []);
      if (opened.length === 0) {
        if (items.length > 0) {
          const openedThreadId = openThreadInProjectTab(projectTabId, items[0]);
          if (projectTabId === activeProjectTabId && openedThreadId) {
            viewThread(openedThreadId).catch(() => {});
          }
        } else if (projectKey) {
          const created = await api("/api/projects/open-thread", {
            method: "POST",
            body: JSON.stringify({ project_key: projectKey }),
          });
          const createdThreadId = normalizeThreadId(created?.thread_id);
          if (createdThreadId) {
            openThreadInProjectTab(projectTabId, { id: createdThreadId, title: createdThreadId });
            if (projectTabId === activeProjectTabId) {
              viewThread(createdThreadId).catch(() => {});
            }
          }
        }
      } else if (!normalizeThreadId(activeThreadTabIdByProjectTabId[projectTabId])) {
        const defaultThreadId = normalizeThreadId(opened[0]?.id || "");
        setActiveThreadForProjectTab(projectTabId, defaultThreadId);
        if (projectTabId === activeProjectTabId && defaultThreadId) {
          viewThread(defaultThreadId).catch(() => {});
        }
      }
    }
  };

  const loadProjects = async () => {
    const result = await api("/api/projects");
    const items = Array.isArray(result.items) ? result.items : [];
    setProjectItems(items);
    if (!projectTabs.length && initialLoadRef.current) {
      initialLoadRef.current = false;
      const defaultItem = items.find((item) => item?.default) || items[0];
      if (defaultItem) {
        const tabId = upsertProjectTab(defaultItem);
        if (tabId) {
          setActiveProjectTabId(tabId);
        }
      }
      return;
    }
    if (projectTabs.length) {
      setProjectTabs((prev) =>
        prev.map((tab) => {
          const matched = items.find((item) => item?.key === tab.key);
          if (!matched) {
            return tab;
          }
          return {
            ...tab,
            name: matched.name || tab.name,
            path: matched.path || tab.path,
          };
        })
      );
    }
  };

  const loadSkillSuggestions = async () => {
    const skillsResult = await api("/api/skills");
    const skills = Array.isArray(skillsResult.meta?.skill_names) ? skillsResult.meta.skill_names : [];
    setSkillSuggestions([...new Set(skills.filter((v) => typeof v === "string" && v))]);
  };
  const loadSessionSummary = async () => {
    const summary = await api("/api/session/summary");
    setSessionSummary(summary);
    const summaryThreadId = normalizeThreadId(summary?.active_thread_id);
    const hasActiveTurn = !!summary?.active_turn_id;
    setThreadTabsByProjectTabId((prev) => {
      const next = {};
      for (const [projectTabId, rows] of Object.entries(prev)) {
        next[projectTabId] = (Array.isArray(rows) ? rows : []).map((row) => {
          const rowThreadId = normalizeThreadId(row?.id);
          if (!rowThreadId) {
            return row;
          }
          if (hasActiveTurn && rowThreadId === summaryThreadId) {
            if (row.status === "running") {
              return row;
            }
            return { ...row, status: "running" };
          }
          if (!hasActiveTurn && row.status === "running") {
            return { ...row, status: "idle" };
          }
          return row;
        });
      }
      return next;
    });
    if (summaryThreadId) {
      updateThreadUi(summaryThreadId, { status: hasActiveTurn ? "running" : "idle" });
    }
    if (summaryThreadId && summaryThreadId === activeThreadRef.current) {
      setStatusForActiveThread(hasActiveTurn ? "running" : "idle");
    } else if (!hasActiveTurn) {
      setStatus((current) => (current === "running" ? "idle" : current));
    }
    if (typeof summary?.collaboration_mode === "string") {
      setCollaborationMode(normalizeCollaborationMode(summary.collaboration_mode));
    }
  };
  const loadApprovals = async () => {
    const result = await api("/api/approvals");
    const items = Array.isArray(result.items) ? result.items : [];
    const filtered = items.filter((item) => item && typeof item.id === "number");
    setApprovalItems(filtered.length ? [filtered[filtered.length - 1]] : []);
  };

  const normalizeThreadMessages = (result, normalizedThreadId) => {
    const list = Array.isArray(result?.messages) && result.messages.length > 0
      ? result.messages
        .filter((item) => item && typeof item.text === "string" && item.text.trim())
        .map((item) => ({
          role: item.role === "user" ? "user" : item.role === "assistant" ? "assistant" : "system",
          text: item.text,
          variant: item.variant === "subagent" ? "subagent" : "",
          kind: item.kind === "plan" ? "plan" : "",
          threadId: normalizeThreadId(item.thread_id) || normalizedThreadId,
          turnId: typeof item.turn_id === "string" ? item.turn_id : "",
          streaming: false,
        }))
      : [
        {
          role: "assistant",
          text: result?.text || "",
          threadId: normalizeThreadId(result?.thread_id) || normalizedThreadId,
          turnId: typeof result?.turn_id === "string" ? result.turn_id : "",
          streaming: false,
        },
      ];
    return list;
  };

  const syncThreadMessagesFromServer = async (threadId, options = {}) => {
    const { applyToVisible = true } = options;
    const normalizedThreadId = normalizeThreadId(threadId);
    if (!normalizedThreadId) {
      return;
    }
    const result = await api(`/api/threads/read?thread_id=${encodeURIComponent(normalizedThreadId)}`);
    const nextMessages = normalizeThreadMessages(result, normalizedThreadId);
    setMessagesByThreadId((prev) => ({ ...prev, [normalizedThreadId]: nextMessages }));
    if (applyToVisible && activeThreadRef.current === normalizedThreadId) {
      setMessages(nextMessages);
    }
  };

  const submitApproval = async (requestId, decision) => {
    if (typeof requestId !== "number" || !decision || approvalBusyId !== null) {
      return;
    }
    setApprovalBusyId(requestId);
    try {
      await api(`/api/approvals/${requestId}`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      setApprovalItems((prev) => prev.filter((item) => item.id !== requestId));
    } finally {
      setApprovalBusyId(null);
    }
  };

  const closeApproval = () => {
    setApprovalItems([]);
  };

  const startThread = async (options = {}) => {
    const replaceCurrentTab = !!options.replaceCurrentTab;
    let nextThreadId = "";
    if (activeProjectKey) {
      const result = await api("/api/projects/open-thread", {
        method: "POST",
        body: JSON.stringify({ project_key: activeProjectKey }),
      });
      nextThreadId = normalizeThreadId(result?.thread_id);
      if (activeProjectTabId && nextThreadId) {
        const currentThreadTabId = normalizeThreadId(
          activeThreadTabIdByProjectTabId[activeProjectTabId] || activeThread
        );
        if (replaceCurrentTab && currentThreadTabId) {
          setThreadTabsByProjectTabId((prev) => {
            const rows = Array.isArray(prev[activeProjectTabId]) ? prev[activeProjectTabId] : [];
            const index = rows.findIndex((row) => normalizeThreadId(row.id) === currentThreadTabId);
            if (index < 0) {
              return {
                ...prev,
                [activeProjectTabId]: [...rows, { id: nextThreadId, title: nextThreadId, status: "idle", hasUnreadCompletion: false }],
              };
            }
            const nextRows = [...rows];
            nextRows[index] = {
              ...nextRows[index],
              id: nextThreadId,
              title: nextThreadId,
              status: "idle",
              hasUnreadCompletion: false,
            };
            return { ...prev, [activeProjectTabId]: nextRows };
          });
          setThreadProjectTabIdByThreadId((prev) => {
            const next = { ...prev };
            delete next[currentThreadTabId];
            next[nextThreadId] = activeProjectTabId;
            return next;
          });
          removeWorkspaceBucket(currentThreadTabId);
          ensureWorkspaceBucket(nextThreadId);
          setActiveThreadForProjectTab(activeProjectTabId, nextThreadId);
        } else {
          openThreadInProjectTab(activeProjectTabId, { id: nextThreadId, title: nextThreadId });
        }
      }
    } else {
      const result = await api("/api/threads/start", { method: "POST", body: "{}" });
      nextThreadId = normalizeThreadId(result?.meta?.thread_id);
    }
    setMessages([]);
    setStatus("idle");
    pendingComposerFocusRef.current = true;
    if (nextThreadId) {
      setActiveThread(nextThreadId);
      if (activeProjectTabId) {
        setActiveThreadForProjectTab(activeProjectTabId, nextThreadId);
      }
    } else {
      await loadSessionSummary();
    }
    await loadThreads({ projectKey: activeProjectKey, projectTabId: activeProjectTabId });
  };

  const selectProject = async (target, forcedMode = "") => {
    const normalizedTarget = typeof target === "string" ? target.trim() : "";
    if (!normalizedTarget || interactionBusy) {
      return;
    }
    const existingTabForTarget = projectTabs.find((tab) => tab.key === normalizedTarget);
    if (!forcedMode && existingTabForTarget) {
      setActiveProjectTabId(existingTabForTarget.id);
      if (isMobileLayout) {
        setIsSidebarOpen(false);
      }
      return;
    }
    let resolvedMode = forcedMode;
    if (!resolvedMode) {
      if (!projectTabs.length) {
        resolvedMode = "open_new_tab";
      } else {
        setPendingProjectTarget(normalizedTarget);
        setIsProjectModeModalOpen(true);
        return;
      }
    }
    try {
      const selectedProject = projectItems.find((item) => item?.key === normalizedTarget);
      let projectTabId = "";
      if (resolvedMode === "replace_current" && activeProjectTabId) {
        const nextProject = selectedProject || { key: normalizedTarget, name: normalizedTarget, path: "" };
        projectTabId = activeProjectTabId;
        setProjectTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeProjectTabId
              ? {
                  ...tab,
                  key: nextProject.key,
                  name: nextProject.name || nextProject.key,
                  path: nextProject.path || "",
                }
              : tab
          )
        );
        setThreadTabsByProjectTabId((prev) => ({ ...prev, [activeProjectTabId]: [] }));
        setActiveThreadTabIdByProjectTabId((prev) => ({ ...prev, [activeProjectTabId]: "" }));
        const ownedThreads = Array.isArray(threadTabsByProjectTabId[activeProjectTabId])
          ? threadTabsByProjectTabId[activeProjectTabId].map((row) => normalizeThreadId(row.id)).filter(Boolean)
          : [];
        ownedThreads.forEach((threadId) => removeWorkspaceBucket(threadId));
        setThreadProjectTabIdByThreadId((prev) => {
          const next = { ...prev };
          Object.entries(next).forEach(([threadId, tabId]) => {
            if (tabId === activeProjectTabId) {
              delete next[threadId];
            }
          });
          return next;
        });
      } else {
        projectTabId = upsertProjectTab(
          selectedProject || { key: normalizedTarget, name: normalizedTarget, path: "" },
          { forceNew: resolvedMode === "open_new_tab" }
        );
      }
      if (projectTabId) {
        setActiveProjectTabId(projectTabId);
      }
      setMessages([]);
      setStatus("idle");
      setActiveThread("");
      pendingComposerFocusRef.current = true;
      await loadSessionSummary();
      await loadProjects();
      await loadThreads({
        projectKey: normalizedTarget,
        projectTabId,
        ensureDefaultTab: false,
        resetThreadTabs: resolvedMode === "replace_current",
      });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: err.message || "Failed to switch project.",
          threadId: normalizeThreadId(activeThread),
          turnId: "",
          streaming: false,
        },
      ]);
    }
  };

  const chooseProjectClickMode = (mode) => {
    const normalizedMode = mode === "replace_current" ? "replace_current" : "open_new_tab";
    const target = pendingProjectTarget;
    setPendingProjectTarget("");
    setIsProjectModeModalOpen(false);
    if (target) {
      selectProject(target, normalizedMode).catch(() => {});
    }
  };

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

  const loadAgentConfig = async (agentName, options = {}) => {
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

  const buildAgentPayload = (agentName, draft, options = {}) => {
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

  const saveAgentSettings = async (agentName = activeAgentSettings, options = {}) => {
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
    const activeThreadId = normalizeThreadId(activeThread);
    if (activeThreadId) {
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

  const normalizeCollaborationMode = (raw) => {
    if (typeof raw !== "string") {
      return "build";
    }
    return raw.trim().toLowerCase() === "plan" ? "plan" : "build";
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

  const viewThread = async (threadId) => {
    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
    const normalizedThreadId = normalizeThreadId(threadId);
    setActiveThread(normalizedThreadId);
    if (activeProjectTabId) {
      const threadInfo = threadItems.find((item) => normalizeThreadId(item?.id) === normalizedThreadId);
      openThreadInProjectTab(activeProjectTabId, {
        id: normalizedThreadId,
        title: threadInfo?.title || normalizedThreadId,
      });
      updateThreadTabState(normalizedThreadId, { hasUnreadCompletion: false });
    }
    const restored = restoreThreadMessages(normalizedThreadId);
    if (!restored) {
      const rows = Array.isArray(threadTabsByProjectTabId[activeProjectTabId])
        ? threadTabsByProjectTabId[activeProjectTabId]
        : [];
      const threadTab = rows.find((tab) => normalizeThreadId(tab.id) === normalizedThreadId);
      const isRunning = threadTab?.status === "running";
      if (!isRunning) {
        setMessages([]);
        await syncThreadMessagesFromServer(normalizedThreadId, { applyToVisible: true });
      }
    }
  };

  const runCommand = async (line) => {
    const cmd = (line || "").trim();
    if (!cmd) {
      return;
    }
    const commandThreadId = normalizeThreadId(activeThread);
    appendMessageToThread(commandThreadId, { role: "user", text: cmd, turnId: "" });
    setStatusForThread(commandThreadId, "running");
    const result = await api("/api/command", {
      method: "POST",
      body: JSON.stringify({ command_line: cmd }),
    });
    if (result?.meta?.collaboration_mode) {
      setCollaborationMode(normalizeCollaborationMode(result.meta.collaboration_mode));
    }
    const responseThreadId = normalizeThreadId(result?.meta?.thread_id) || commandThreadId;
    if (responseThreadId && activeProjectTabId) {
      const threadInfo = threadItems.find((item) => normalizeThreadId(item?.id) === responseThreadId);
      openThreadInProjectTab(activeProjectTabId, {
        id: responseThreadId,
        title: threadInfo?.title || responseThreadId,
      });
    }
    appendMessageToThread(responseThreadId, {
      role: "assistant",
      text: result.text,
      threadId: responseThreadId,
      turnId: typeof result?.meta?.turn_id === "string" ? result.meta.turn_id : "",
    });
    setStatusForThread(responseThreadId, "idle");
    if (
      cmd.startsWith("/threads") ||
      cmd.startsWith("/start") ||
      cmd.startsWith("/resume") ||
      cmd.startsWith("/project")
    ) {
      loadThreads({ projectKey: activeProjectKey, projectTabId: activeProjectTabId }).catch(() => {});
    }
    if (cmd.startsWith("/projects") || cmd.startsWith("/project")) {
      loadProjects().catch(() => {});
    }
    loadSessionSummary().catch(() => {});
  };

  useEffect(() => {
    if (!me) {
      return;
    }
    loadProjects().catch(() => {});
    loadThreads({ projectKey: activeProjectKey, projectTabId: activeProjectTabId }).catch(() => {});
    loadSkillSuggestions().catch(() => {});
    loadSessionSummary().catch(() => {});
    loadApprovals().catch(() => {});

    const es = new EventSource("/api/events/stream", { withCredentials: true });
    const safeParseSseData = (eventType, ev) => {
      try {
        return JSON.parse(ev.data);
      } catch (err) {
        debugError("[SSE parse error]", eventType, ev?.data, err);
        return null;
      }
    };
    const logSseEvent = (eventType, data) => {
      if (!data || typeof data !== "object") {
        debugLog("[SSE]", eventType, data);
        return;
      }
      const text = typeof data.text === "string" ? data.text : "";
      debugLog("[SSE]", {
        eventType,
        method: typeof data.method === "string" ? data.method : "",
        thread_id: typeof data.thread_id === "string" ? data.thread_id : "",
        turn_id: typeof data.turn_id === "string" ? data.turn_id : "",
        text: text ? text.slice(0, 200) : "",
        payload: data,
      });
    };
    const recordItemPhase = (data) => {
      if (!data || typeof data !== "object") {
        return;
      }
      const turnId = typeof data.turn_id === "string" && data.turn_id ? data.turn_id : "";
      if (!turnId) {
        return;
      }
      const item = data?.params?.item;
      if (!item || typeof item !== "object") {
        return;
      }
      const itemId = typeof item.id === "string" && item.id ? item.id : (typeof data.item_id === "string" ? data.item_id : "");
      const phase = typeof item.phase === "string" ? item.phase.toLowerCase() : "";
      if (!itemId || !phase) {
        return;
      }
      const turnMap = itemPhaseByTurnRef.current[turnId] || {};
      turnMap[itemId] = phase;
      itemPhaseByTurnRef.current[turnId] = turnMap;
    };
    const pruneCommentaryAfterCompletion = (threadId, turnId) => {
      if (!turnId) {
        return;
      }
      const phaseMap = itemPhaseByTurnRef.current[turnId] || {};
      const hasFinal = Object.values(phaseMap).includes("final_answer");
      if (!hasFinal) {
        return;
      }
      applyMessageMutationForThread(threadId, (prev) =>
        prev.filter((message) => {
          if (message.role !== "assistant") {
            return true;
          }
          if ((message.turnId || "") !== turnId) {
            return true;
          }
          const itemId = typeof message.itemId === "string" ? message.itemId : "";
          const phase = itemId ? phaseMap[itemId] : "";
          return phase !== "commentary";
        }).map((message) => (message.streaming ? { ...message, streaming: false } : message))
      );
      delete itemPhaseByTurnRef.current[turnId];
    };
    const extractEventText = (data) => {
      if (!data || typeof data !== "object") {
        return "";
      }
      if (typeof data.text === "string" && data.text.trim()) {
        return data.text;
      }
      const item = data?.params?.item;
      if (!item || typeof item !== "object") {
        return "";
      }
      if (typeof item.text === "string" && item.text.trim()) {
        return item.text;
      }
      const content = item.content;
      if (Array.isArray(content)) {
        for (const entry of content) {
          if (entry && typeof entry === "object" && typeof entry.text === "string" && entry.text.trim()) {
            return entry.text;
          }
        }
      }
      return "";
    };
    const extractEventItemId = (data) => {
      if (!data || typeof data !== "object") {
        return "";
      }
      if (typeof data.item_id === "string" && data.item_id) {
        return data.item_id;
      }
      const item = data?.params?.item;
      if (item && typeof item === "object" && typeof item.id === "string" && item.id) {
        return item.id;
      }
      return "";
    };
    es.onopen = () => {
      debugLog("[SSE] connected");
    };
    es.addEventListener("turn_delta", (ev) => {
      const data = safeParseSseData("turn_delta", ev);
      if (!data) {
        return;
      }
      logSseEvent("turn_delta", data);
      const method = typeof data.method === "string" ? data.method : "";
      const text = extractEventText(data);
      if (!text) {
        debugLog("[SSE] turn_delta ignored: empty text", data);
        return;
      }
      const variant = data.variant === "subagent" ? "subagent" : "";
      const turnId = typeof data.turn_id === "string" && data.turn_id ? data.turn_id : "";
      const itemId = extractEventItemId(data);
      const phase =
        turnId && itemId && itemPhaseByTurnRef.current[turnId]
          ? itemPhaseByTurnRef.current[turnId][itemId] || ""
          : "";
      const threadId = resolveThreadIdFromTurn(data.thread_id, turnId);
      if (!threadId && turnId) {
        debugLog("[SSE] turn_delta ignored: unresolved thread_id for turn", { turnId, data });
        return;
      }
      if (turnId) {
        streamedTurnIdsRef.current[turnId] = true;
      }
      if (method === "item/completed") {
        // The full completed text can duplicate already-streamed delta chunks.
        // For completed notifications, just finalize the current streaming message.
        applyMessageMutationForThread(threadId, (prev) => {
          const copy = [...prev];
          let targetIndex = -1;
          for (let i = copy.length - 1; i >= 0; i -= 1) {
            const message = copy[i];
            if (message.role !== "assistant") {
              continue;
            }
            if (turnId && (message.turnId || "") !== turnId) {
              continue;
            }
            if ((message.variant || "") !== variant) {
              continue;
            }
            if (itemId && (message.itemId || "") === itemId) {
              targetIndex = i;
              break;
            }
            if (!itemId) {
              targetIndex = i;
              break;
            }
            if (targetIndex < 0 && message.streaming) {
              // Fallback for streams where early deltas do not carry item_id.
              targetIndex = i;
            }
          }
          if (targetIndex >= 0) {
            const current = copy[targetIndex];
            copy[targetIndex] = {
              ...current,
              threadId: current.threadId || threadId,
              turnId: current.turnId || turnId,
              itemId: current.itemId || itemId,
              phase: current.phase || phase,
              streaming: false,
            };
            return copy;
          }
          debugLog("[SSE] turn_delta item/completed unmatched: append fallback", {
            threadId,
            turnId,
            itemId,
            variant,
            assistantTail: copy
              .slice(-5)
              .filter((message) => message?.role === "assistant")
              .map((message) => ({
                turnId: message?.turnId || "",
                itemId: message?.itemId || "",
                variant: message?.variant || "",
                streaming: !!message?.streaming,
                text: typeof message?.text === "string" ? message.text.slice(0, 80) : "",
              })),
          });
          copy.push({ role: "assistant", text, variant, threadId, turnId, itemId, phase, streaming: false });
          return copy;
        });
        if (turnId) {
          assistantItemCompletedByTurnRef.current[turnId] = true;
        }
        return;
      }
      applyMessageMutationForThread(threadId, (prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        const shouldStartNewMessage = turnId && assistantItemCompletedByTurnRef.current[turnId];
        if (shouldStartNewMessage && turnId) {
          delete assistantItemCompletedByTurnRef.current[turnId];
        }
        if (
          !shouldStartNewMessage &&
          last &&
          last.role === "assistant" &&
          last.streaming &&
          (last.variant || "") === variant &&
          ((last.itemId || "") === itemId || !itemId || (itemId && !(last.itemId || ""))) &&
          ((last.turnId || "") === turnId || !turnId)
        ) {
          last.text += text;
          if (!last.threadId && threadId) {
            last.threadId = threadId;
          }
          if (!last.turnId && turnId) {
            last.turnId = turnId;
          }
          if (!last.itemId && itemId) {
            last.itemId = itemId;
          }
          if (!last.phase && phase) {
            last.phase = phase;
          }
          return copy;
        }
        copy.push({ role: "assistant", text, variant, threadId, turnId, itemId, phase, streaming: true });
        return copy;
      });
    });
    es.addEventListener("plan_delta", (ev) => {
      const data = safeParseSseData("plan_delta", ev);
      if (!data) {
        return;
      }
      logSseEvent("plan_delta", data);
      upsertPlanMessage("append", data);
    });
    es.addEventListener("plan_completed", (ev) => {
      const data = safeParseSseData("plan_completed", ev);
      if (!data) {
        return;
      }
      logSseEvent("plan_completed", data);
      upsertPlanMessage("final", data);
      loadSessionSummary().catch(() => {});
    });
    es.addEventListener("plan_checklist", (ev) => {
      const data = safeParseSseData("plan_checklist", ev);
      if (!data) {
        return;
      }
      logSseEvent("plan_checklist", data);
      upsertPlanChecklist(data);
    });
    es.addEventListener("reasoning_status", (ev) => {
      const data = safeParseSseData("reasoning_status", ev);
      if (!data) {
        return;
      }
      logSseEvent("reasoning_status", data);
      appendReasoningStatus(data);
    });
    es.addEventListener("reasoning_completed", (ev) => {
      const data = safeParseSseData("reasoning_completed", ev);
      if (!data) {
        return;
      }
      logSseEvent("reasoning_completed", data);
      completeReasoning(data);
    });
    es.addEventListener("web_search_item", (ev) => {
      const data = safeParseSseData("web_search_item", ev);
      if (!data) {
        return;
      }
      logSseEvent("web_search_item", data);
      const query = typeof data?.query === "string" ? data.query.trim() : "";
      const actionText = formatWebSearchAction(data?.action);
      if (!query && !actionText) {
        return;
      }
      appendMessageToThread(normalizeThreadId(data?.thread_id), {
        role: "system",
        kind: "web_search",
        threadId: normalizeThreadId(data?.thread_id),
        turnId: typeof data?.turn_id === "string" ? data.turn_id : "",
        itemId: typeof data?.item_id === "string" ? data.item_id : "",
        text: query || "Web search",
        detail: actionText,
        streaming: false,
      });
    });
    es.addEventListener("image_generation_item", (ev) => {
      const data = safeParseSseData("image_generation_item", ev);
      if (!data) {
        return;
      }
      logSseEvent("image_generation_item", data);
      const detailLines = [];
      const revisedPrompt = typeof data?.revised_prompt === "string" ? data.revised_prompt.trim() : "";
      const savedPath = typeof data?.saved_path === "string" ? data.saved_path.trim() : "";
      const statusText = typeof data?.status === "string" ? data.status.trim() : "";
      if (statusText) {
        detailLines.push(`Status: ${statusText}`);
      }
      if (savedPath) {
        detailLines.push(`Saved to: ${savedPath}`);
      }
      appendMessageToThread(normalizeThreadId(data?.thread_id), {
        role: "system",
        kind: "image_generation",
        threadId: normalizeThreadId(data?.thread_id),
        turnId: typeof data?.turn_id === "string" ? data.turn_id : "",
        itemId: typeof data?.item_id === "string" ? data.item_id : "",
        text: revisedPrompt || "Generated image",
        detail: detailLines.join("\n"),
        streaming: false,
      });
    });
    es.addEventListener("context_compacted_item", (ev) => {
      const data = safeParseSseData("context_compacted_item", ev);
      if (!data) {
        return;
      }
      logSseEvent("context_compacted_item", data);
      const text = typeof data?.text === "string" && data.text.trim() ? data.text.trim() : "Context compacted";
      appendMessageToThread(normalizeThreadId(data?.thread_id), {
        role: "system",
        text,
        threadId: normalizeThreadId(data?.thread_id),
        turnId: typeof data?.turn_id === "string" ? data.turn_id : "",
        streaming: false,
      });
    });
    es.addEventListener("turn_started", (ev) => {
      const data = safeParseSseData("turn_started", ev);
      if (!data) {
        return;
      }
      logSseEvent("turn_started", data);
      const turnId = typeof data?.turn_id === "string" ? data.turn_id : "";
      const eventThreadId = resolveThreadIdFromTurn(data?.thread_id, turnId);
      if (turnId && eventThreadId) {
        turnThreadIdRef.current[turnId] = eventThreadId;
      }
      updateThreadTabState(eventThreadId, { status: "running", hasUnreadCompletion: false });
      setStatusForThread(eventThreadId, "running");
      setActivityDetailForThread(eventThreadId, "");
      const actualMode = data?.params?.collaboration_mode_kind || data?.params?.collaborationModeKind;
      if (typeof actualMode === "string") {
        setCollaborationMode(normalizeCollaborationMode(actualMode));
      }
      reasoningStateRef.current = {};
      if (eventThreadId === activeThreadRef.current) {
        setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
      }
    });
    es.addEventListener("turn_completed", (ev) => {
      const data = safeParseSseData("turn_completed", ev);
      if (!data) {
        return;
      }
      logSseEvent("turn_completed", data);
      const turnId = typeof data?.turn_id === "string" ? data.turn_id : "";
      const completedThreadId = resolveThreadIdFromTurn(data?.thread_id, turnId);
      if (turnId) {
        delete turnThreadIdRef.current[turnId];
      }
      const shouldNotify = completedThreadId && completedThreadId !== activeThreadRef.current;
      updateThreadTabState(completedThreadId, {
        status: "completed",
        hasUnreadCompletion: completedThreadId ? shouldNotify : true,
      });
      if (shouldNotify) {
        playTurnNotification();
      }
      setStatusForThread(completedThreadId, "idle");
      setActivityDetailForThread(completedThreadId, "");
      reasoningStateRef.current = {};
      if (completedThreadId === activeThreadRef.current) {
        setMessages((prev) => prev.map((m) => ({ ...m, streaming: false })));
      }
      const hasStreamed = turnId ? !!streamedTurnIdsRef.current[turnId] : false;
      if (turnId) {
        delete streamedTurnIdsRef.current[turnId];
        delete assistantItemCompletedByTurnRef.current[turnId];
      }
      loadThreads({
        projectKey: activeProjectKeyRef.current,
        projectTabId: activeProjectTabIdRef.current,
      }).catch(() => {});
      loadProjects().catch(() => {});
      loadSessionSummary().catch(() => {});
      loadWorkspaceStatus().catch(() => {});
      if (approvalItems.length) {
        setApprovalItems([]);
      }
    });
    es.addEventListener("turn_failed", (ev) => {
      const data = safeParseSseData("turn_failed", ev);
      if (!data) {
        return;
      }
      logSseEvent("turn_failed", data);
      const turnId = typeof data?.turn_id === "string" ? data.turn_id : "";
      if (turnId) {
        delete streamedTurnIdsRef.current[turnId];
        delete assistantItemCompletedByTurnRef.current[turnId];
      }
      const failedThreadId = resolveThreadIdFromTurn(data?.thread_id, turnId);
      if (turnId) {
        delete turnThreadIdRef.current[turnId];
      }
      const shouldNotify = failedThreadId && failedThreadId !== activeThreadRef.current;
      updateThreadTabState(failedThreadId, {
        status: "failed",
        hasUnreadCompletion: failedThreadId ? shouldNotify : true,
      });
      if (shouldNotify) {
        playTurnNotification();
      }
      const text = data.text || "Turn failed.";
      const threadId = resolveThreadIdFromTurn(data.thread_id, turnId);
      setStatusForThread(threadId, "idle");
      setActivityDetailForThread(threadId, "");
      reasoningStateRef.current = {};
      appendMessageToThread(threadId, { role: "system", text, threadId, turnId, streaming: false });
      loadProjects().catch(() => {});
      loadSessionSummary().catch(() => {});
    });
    es.addEventListener("turn_cancelled", (ev) => {
      const data = safeParseSseData("turn_cancelled", ev);
      if (!data) {
        return;
      }
      logSseEvent("turn_cancelled", data);
      const turnId = typeof data?.turn_id === "string" ? data.turn_id : "";
      if (turnId) {
        delete streamedTurnIdsRef.current[turnId];
        delete assistantItemCompletedByTurnRef.current[turnId];
      }
      const cancelledThreadId = resolveThreadIdFromTurn(data?.thread_id, turnId);
      if (turnId) {
        delete turnThreadIdRef.current[turnId];
      }
      const shouldNotify = cancelledThreadId && cancelledThreadId !== activeThreadRef.current;
      updateThreadTabState(cancelledThreadId, {
        status: "cancelled",
        hasUnreadCompletion: cancelledThreadId ? shouldNotify : true,
      });
      if (shouldNotify) {
        playTurnNotification();
      }
      setStatusForThread(cancelledThreadId, "idle");
      setActivityDetailForThread(cancelledThreadId, "");
      reasoningStateRef.current = {};
      loadProjects().catch(() => {});
      loadSessionSummary().catch(() => {});
    });
    es.addEventListener("approval_required", (ev) => {
      const data = safeParseSseData("approval_required", ev);
      if (!data) {
        return;
      }
      logSseEvent("approval_required", data);
      if (!data || typeof data.id !== "number") {
        return;
      }
      setApprovalBusyId(null);
      setApprovalItems([data]);
    });
    es.addEventListener("system_message", (ev) => {
      const data = safeParseSseData("system_message", ev);
      if (!data) {
        return;
      }
      logSseEvent("system_message", data);
      const text = data.text || "";
      if (!text) {
        return;
      }
      appendMessageToThread(normalizeThreadId(data.thread_id), {
        role: "system",
        text,
        threadId: normalizeThreadId(data.thread_id),
        turnId: typeof data.turn_id === "string" ? data.turn_id : "",
        streaming: false,
      });
      loadSessionSummary().catch(() => {});
      loadWorkspaceStatus().catch(() => {});
    });
    es.addEventListener("file_change", (ev) => {
      const data = safeParseSseData("file_change", ev);
      if (!data) {
        return;
      }
      logSseEvent("file_change", data);
      const summary = data.summary || data.text || "";
      const files = Array.isArray(data.files) ? data.files : [];
      const diff = typeof data.diff === "string" ? data.diff : "";
      const threadId = normalizeThreadId(data.thread_id);
      const turnId = typeof data.turn_id === "string" ? data.turn_id : "";
      if (!summary && files.length === 0 && !diff) {
        return;
      }
      appendMessageToThread(threadId, {
        role: "system",
        text: summary || "Applied patch changes",
        files,
        diff,
        threadId,
        turnId,
        kind: "file_change",
        streaming: false,
      });
      loadSessionSummary().catch(() => {});
    });
    es.addEventListener("app_event", (ev) => {
      const data = safeParseSseData("app_event", ev);
      if (!data) {
        return;
      }
      logSseEvent("app_event", data);
      if (data.method === "item/started" || data.method === "item/completed") {
        recordItemPhase(data);
      }
      const method = typeof data.method === "string" ? data.method : "";
      if (method !== "item/completed") {
        return;
      }
      const item = data?.params?.item;
      const itemType = typeof item?.type === "string" ? item.type.toLowerCase() : "";
      if (!["agentmessage", "assistantmessage", "message"].includes(itemType)) {
        return;
      }
      const text = extractEventText(data);
      if (!text) {
        return;
      }
      const turnId = typeof data.turn_id === "string" && data.turn_id ? data.turn_id : "";
      const threadId = resolveThreadIdFromTurn(data.thread_id, turnId);
      if (!threadId && turnId) {
        return;
      }
      if (turnId && streamedTurnIdsRef.current[turnId]) {
        return;
      }
      applyMessageMutationForThread(threadId, (prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (
          last &&
          last.role === "assistant" &&
          last.streaming &&
          ((last.turnId || "") === turnId || !turnId)
        ) {
          last.text += text;
          if (!last.threadId && threadId) {
            last.threadId = threadId;
          }
          if (!last.turnId && turnId) {
            last.turnId = turnId;
          }
          return copy;
        }
        copy.push({ role: "assistant", text, threadId, turnId, streaming: true });
        return copy;
      });
    });
    es.onerror = () => {
      debugError("[SSE] connection error");
      setStatusForThread(activeThreadRef.current, "disconnected");
    };

    return () => es.close();
  }, [me, turnNotificationEnabled]);

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
    const selectedThreadId = normalizeThreadId(activeThreadTabIdByProjectTabId[activeProjectTabId]) || "";
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
  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const syncViewport = () => {
      setIsMobileLayout(window.innerWidth <= MOBILE_BREAKPOINT);
      setIsCompactWorkspaceLayout(window.innerWidth <= WORKSPACE_PANEL_BREAKPOINT);
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
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobileLayout, isSidebarOpen]);
  useEffect(() => {
    if (!isResizingSidebar) {
      return;
    }
    const onMove = (event) => {
      const next = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, event.clientX));
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
    const onMove = (event) => {
      const delta = workspaceResizeRef.current.startX - event.clientX;
      const next = workspaceResizeRef.current.startWidth + delta;
      setWorkspacePanelWidth(
        Math.max(WORKSPACE_PANEL_MIN, Math.min(WORKSPACE_PANEL_MAX, next))
      );
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

  useEffect(() => {
    if (shortcutModalPage === "project") {
      setSelectedProjectIndex(0);
    }
  }, [projectSearchQuery, shortcutModalPage]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const onKeyDown = (event) => {
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
        const target = event.target;
        const isInputFocused = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
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
          case "[":
            {
              const threadTabs = threadTabsByProjectTabId[activeProjectTabId] || [];
              const currentIndex = threadTabs.findIndex((t) => normalizeThreadId(t.id) === normalizeThreadId(activeThread));
              if (currentIndex > 0) {
                viewThreadRef.current?.(threadTabs[currentIndex - 1].id);
              } else if (threadTabs.length > 0) {
                viewThreadRef.current?.(threadTabs[threadTabs.length - 1].id);
              }
            }
            break;
          case "]":
            {
              const threadTabs = threadTabsByProjectTabId[activeProjectTabId] || [];
              const currentIndex = threadTabs.findIndex((t) => normalizeThreadId(t.id) === normalizeThreadId(activeThread));
              if (currentIndex < threadTabs.length - 1 && currentIndex >= 0) {
                viewThreadRef.current?.(threadTabs[currentIndex + 1].id);
              } else if (threadTabs.length > 0) {
                viewThreadRef.current?.(threadTabs[0].id);
              }
            }
            break;
          case "1":
          case "2":
          case "3":
          case "4":
          case "5":
          case "6":
          case "7":
          case "8":
          case "9":
            {
              const num = parseInt(event.key, 10);
              const threadTabs = threadTabsByProjectTabId[activeProjectTabId] || [];
              if (threadTabs[num - 1]) {
                viewThreadRef.current?.(threadTabs[num - 1].id);
              }
            }
            break;
          default:
            break;
        }
        return;
      }
      if (!ctrlKey) {
        return;
      }
      const target = event.target;
      const isInputFocused = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
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
          if (event.shiftKey) {
            if (collaborationMode !== "plan" && !modeSwitchBusy) {
              api("/api/command", {
                method: "POST",
                body: JSON.stringify({ command_line: "/mode plan" }),
              }).then((result) => {
                if (result?.meta?.collaboration_mode) {
                  setCollaborationMode("plan");
                }
              }).catch(() => {});
            }
          }
          break;
        case "b":
        case "B":
          if (collaborationMode !== "build" && !modeSwitchBusy) {
            api("/api/command", {
              method: "POST",
              body: JSON.stringify({ command_line: "/mode build" }),
            }).then((result) => {
              if (result?.meta?.collaboration_mode) {
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
  }, [
    shortcutModalPage,
    interactionBusy,
    activeThread,
    activeProjectTabId,
    threadTabsByProjectTabId,
    collaborationMode,
    modeSwitchBusy,
    isCompactWorkspaceLayout,
    focusComposerRef,
  ]);

  useEffect(() => {
    if (shortcutModalPage !== "project" || typeof window === "undefined") {
      return undefined;
    }
    const onKeyDown = (event) => {
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
        if (target) {
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

  const upsertPlanMessage = (mode, payload) => {
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

  const upsertPlanChecklist = (payload) => {
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

  const appendReasoningStatus = (payload) => {
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

  const completeReasoning = (payload) => {
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
  const workspaceStatusItems =
    workspaceStatus && typeof workspaceStatus.items === "object" ? workspaceStatus.items : {};
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

  const renderWorkspaceTree = (path = "", depth = 0) => {
    const normalizedPath = normalizeWorkspacePath(path);
    const items = Array.isArray(workspaceTree[normalizedPath]) ? workspaceTree[normalizedPath] : [];
    if (!items.length && normalizedPath) {
      return null;
    }
    return items.map((item) => {
      const itemPath = normalizeWorkspacePath(item.path);
      const isDirectory = item.type === "directory";
      const isExpanded = !!expandedWorkspaceDirs[itemPath];
      const statusCode = isDirectory
        ? (workspaceDirectoryStatus[itemPath] || workspaceStatusItems[itemPath]?.code || "")
        : (workspaceStatusItems[itemPath]?.code || "");
      const isSelected = workspacePreview?.path === itemPath;
      const singleDirChain = [];
      if (isDirectory && isExpanded && item.has_children) {
        let checkPath = itemPath;
        let chainDepth = 0;
        while (chainDepth < 10) {
          const childItems = workspaceTree[checkPath];
          if (!childItems || childItems.length !== 1) break;
          const onlyChild = childItems[0];
          if (onlyChild.type !== "directory") break;
          if (!onlyChild.has_children) {
            singleDirChain.push({ name: onlyChild.name, path: onlyChild.path });
            break;
          }
          singleDirChain.push({ name: onlyChild.name, path: onlyChild.path });
          checkPath = normalizeWorkspacePath(`${checkPath}/${onlyChild.name}`);
          chainDepth++;
        }
      }
      const displayChain = isDirectory && singleDirChain.length > 0 ? [item, ...singleDirChain] : [item];
      return (
        <div key={itemPath} className="workspace-tree-node">
          {displayChain.map((chainItem, chainIndex) => {
            const chainItemPath = normalizeWorkspacePath(chainItem.path);
            const chainIsDirectory = chainItem.type === "directory";
            const chainIsExpanded = chainIndex === 0 ? isExpanded : !!expandedWorkspaceDirs[chainItemPath];
            const isLast = chainIndex === displayChain.length - 1;
            const chainStatusCode = chainIsDirectory
              ? (workspaceDirectoryStatus[chainItemPath] || workspaceStatusItems[chainItemPath]?.code || "")
              : (workspaceStatusItems[chainItemPath]?.code || "");
            const isChainSelected = workspacePreview?.path === chainItemPath;
            const displayName = singleDirChain.length > 0 && !isLast
              ? displayChain.slice(0, chainIndex + 1).map(c => c.name).join("/")
              : chainItem.name;
            return (
              <button
                key={chainItemPath}
                type="button"
                className={`workspace-tree-item ${chainIsDirectory ? "directory" : "file"} ${isChainSelected ? "selected" : ""} ${statusClassName(chainStatusCode)}`}
                style={{ paddingLeft: `${12 + (depth + chainIndex) * 16}px` }}
                onClick={() => {
                  if (chainIsDirectory) {
                    if (isLast) {
                      toggleWorkspaceDirectory(chainItemPath);
                    }
                    return;
                  }
                  openWorkspaceFile(chainItemPath, chainStatusCode).catch(() => {});
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  navigator.clipboard.writeText(chainItemPath);
                }}
              >
                <span className="workspace-tree-icon caret">
                  {chainIsDirectory && chainItem.has_children ? <ChevronIcon expanded={chainIsExpanded} /> : null}
                </span>
                <span className="workspace-tree-icon glyph">
                  {chainIsDirectory ? <FolderIcon open={chainIsExpanded} /> : <FileIcon />}
                </span>
                <span className="workspace-tree-label">{displayName}</span>
                {chainStatusCode ? <span className="workspace-tree-badge">{chainStatusCode}</span> : null}
              </button>
            );
          })}
          {isDirectory && isExpanded && singleDirChain.length === 0 ? renderWorkspaceTree(itemPath, depth + 1) : null}
          {isDirectory && isExpanded && singleDirChain.length > 0 ? (
            <div key={`${itemPath}-chain-end`}>
              {(() => {
                const lastChainItem = singleDirChain[singleDirChain.length - 1];
                const lastPath = normalizeWorkspacePath(lastChainItem.path);
                const lastChildren = workspaceTree[lastPath] || [];
                return lastChildren.map((child) => {
                  const childPath = normalizeWorkspacePath(child.path);
                  const childIsDirectory = child.type === "directory";
                  const childIsExpanded = !!expandedWorkspaceDirs[childPath];
                  const childStatusCode = childIsDirectory
                    ? (workspaceDirectoryStatus[childPath] || workspaceStatusItems[childPath]?.code || "")
                    : (workspaceStatusItems[childPath]?.code || "");
                  const isChildSelected = workspacePreview?.path === childPath;
                  return (
                    <button
                      key={childPath}
                      type="button"
                      className={`workspace-tree-item ${childIsDirectory ? "directory" : "file"} ${isChildSelected ? "selected" : ""} ${statusClassName(childStatusCode)}`}
                      style={{ paddingLeft: `${12 + (depth + singleDirChain.length) * 16}px` }}
                      onClick={() => {
                        if (childIsDirectory) {
                          toggleWorkspaceDirectory(childPath);
                          return;
                        }
                        openWorkspaceFile(childPath, childStatusCode).catch(() => {});
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        navigator.clipboard.writeText(childPath);
                      }}
                    >
                      <span className="workspace-tree-icon caret">
                        {childIsDirectory && child.has_children ? <ChevronIcon expanded={childIsExpanded} /> : null}
                      </span>
                      <span className="workspace-tree-icon glyph">
                        {childIsDirectory ? <FolderIcon open={childIsExpanded} /> : <FileIcon />}
                      </span>
                      <span className="workspace-tree-label">{child.name}</span>
                      {childStatusCode ? <span className="workspace-tree-badge">{childStatusCode}</span> : null}
                    </button>
                  );
                });
              })()}
            </div>
          ) : null}
        </div>
      );
    });
  };
  const workspacePanelStyle = isCompactWorkspaceLayout ? undefined : { width: workspacePanelWidth };
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
            loadWorkspaceTree("", { force: true }).catch((err) => {
              setWorkspaceError(err.message || "Failed to refresh workspace tree.");
            });
            loadWorkspaceStatus().catch(() => {});
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
                  onClick={() => openWorkspaceFile(path, value?.code || "D").catch(() => {})}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    navigator.clipboard.writeText(path);
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
  const sidebarStyle = isMobileLayout
    ? undefined
    : { width: isDesktopSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth };
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
        <div className="modal-title">프로젝트 탭 동작 선택</div>
        <div className="modal-desc">
          프로젝트 클릭 시 새 탭으로 열지, 현재 탭을 교체할지 선택하세요.
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="primary"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => chooseProjectClickMode("open_new_tab")}
          >
            새 탭으로 열기
          </button>
          <button
            type="button"
            className="secondary"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => chooseProjectClickMode("replace_current")}
          >
            현재 탭 교체
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
            취소
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
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Select</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  ) : null;

  const shortcutModal = null;

  return (
    <div className={`app ${isMobileLayout ? "mobile-layout" : ""}`}>
      {projectModeModal}
      {projectPickerModal}
      {shortcutModal}
      <aside
        id="app-sidebar"
        className={`sidebar ${isMobileLayout ? "mobile" : "desktop"} ${isSidebarOpen ? "open" : ""} ${isDesktopSidebarCollapsed ? "collapsed" : ""}`}
        style={sidebarStyle}
        aria-hidden={isMobileLayout ? !isSidebarOpen : undefined}
      >
        {!isDesktopSidebarCollapsed ? (
          <div className="sidebar-content">
            <div className="sidebar-header-row">
              <div className="brand">Codex Web</div>
              <div className="sidebar-top-actions">
                <button
                  className={`notify-toggle icon-only ${turnNotificationEnabled ? "on" : "off"}`}
                  type="button"
                  onClick={() => {
                    const next = !turnNotificationEnabled;
                    setTurnNotificationEnabled(next);
                    persistTurnNotificationEnabled(next);
                  }}
                  aria-label="Toggle turn completion notification"
                  title={`Turn notification ${turnNotificationEnabled ? "on" : "off"}`}
                >
                  <NotificationIcon enabled={turnNotificationEnabled} />
                </button>
                <button
                  className="theme-toggle icon-only"
                  type="button"
                  onClick={onToggleTheme}
                  aria-label="Toggle theme"
                  title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
                >
                  <ThemeIcon theme={theme} />
                </button>
              </div>
            </div>
            <div className="panel">
              <h3>Enabled Agents</h3>
              <div className="thread-list agent-list">
                {(sessionSummary?.agents || []).map((agent) => (
                  <div key={agent.name} className="agent-row">
                    <button
                      className={`agent-item ${agent.enabled ? "on" : "off"} ${AGENT_CONFIG_DEFS[agent.name] ? "clickable" : "static"}`}
                      onClick={() => toggleAgent(agent.name)}
                      disabled={!AGENT_CONFIG_DEFS[agent.name] || !!agentConfigLoading || !!agentConfigSaving}
                      type="button"
                    >
                      <span>{agent.name}</span>
                      <span>{agent.enabled ? "enabled" : "disabled"}</span>
                    </button>
                    {AGENT_CONFIG_DEFS[agent.name] ? (
                      <button
                        className="agent-settings-btn"
                        onClick={() => openAgentSettings(agent.name)}
                        disabled={!!agentConfigLoading || !!agentConfigSaving}
                        aria-label={`${agent.name} 설정`}
                        title={`${agent.name} 설정`}
                        type="button"
                      >
                        <SettingsIcon />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              {agentConfigError ? <div className="agent-error">{agentConfigError}</div> : null}
              {activeAgentDef ? (
                <div className="agent-settings-card">
                  <div className="agent-settings-head">
                    <strong>{activeAgentDef.title}</strong>
                    <span className={`agent-status-chip ${(activeAgentConfig?.enabled ?? false) ? "on" : "off"}`}>
                      {(activeAgentConfig?.enabled ?? false) ? "enabled" : "disabled"}
                    </span>
                  </div>
                  {activeAgentConfig ? (
                    <div className="agent-settings-form">
                      {activeAgentDef.fields.map((field) => (
                        <label key={field.key} className="agent-field">
                          <span>{field.label}</span>
                          <select
                            value={String(activeAgentConfig[field.key] ?? "")}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const nextValue = typeof field.options[0] === "number" ? Number(raw) : raw;
                              updateAgentDraft(activeAgentSettings, field.key, nextValue);
                            }}
                            disabled={settingsBusy}
                          >
                            {field.options.map((option) => (
                              <option key={String(option)} value={String(option)}>
                                {String(option)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                      {activeAgentSettings === "guardian" ? (
                        <div className="agent-settings-summary">
                          <div className="agent-settings-summary-title">
                            Rules: {guardianRuleSummary.enabled || 0}/{guardianRuleSummary.total || 0} enabled
                          </div>
                          {guardianRuleSummary.action_counts ? (
                            <div className="agent-settings-summary-actions">
                              {["approve", "session", "deny", "manual_fallback"].map((action) => (
                                <span key={action}>
                                  {action}: {guardianRuleSummary.action_counts[action] || 0}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {Array.isArray(guardianRuleSummary.top) && guardianRuleSummary.top.length ? (
                            <div className="agent-settings-summary-list">
                              {guardianRuleSummary.top.slice(0, 3).map((rule, index) => (
                                <div key={`${rule.name || "rule"}:${index}`} className="agent-settings-summary-item">
                                  <span>{rule.name || "unnamed-rule"}</span>
                                  <span>{`${rule.action || "deny"} · p${rule.priority || 0}`}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="agent-settings-empty">No guardian policy rules configured.</div>
                          )}
                          <div className="agent-settings-summary-footer">
                            <button
                              className={`agent-settings-inline-btn ${floatingAgentSettings === "guardian" ? "active" : ""}`}
                              type="button"
                              onClick={() => toggleFloatingAgentSettings("guardian")}
                              disabled={settingsBusy}
                              aria-label="Rules TOML"
                              title="Rules TOML"
                            >
                              <SettingsIcon />
                              <span>Settings</span>
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <div className="agent-settings-actions">
                        <button
                          className="agent-settings-action"
                          type="button"
                          onClick={() =>
                            loadAgentConfig(activeAgentSettings, {
                              syncRulesEditor: activeAgentSettings !== "guardian",
                            }).catch((err) => {
                              setAgentConfigError(err.message || "Failed to refresh settings.");
                            })
                          }
                          disabled={settingsBusy}
                          aria-label="새로고침"
                          title="새로고침"
                        >
                          <RefreshIcon />
                        </button>
                        <button
                          className="agent-settings-action agent-settings-action-primary"
                          type="button"
                          onClick={() =>
                            saveAgentSettings(activeAgentSettings, {
                              includeRules: false,
                            })
                          }
                          disabled={settingsBusy}
                          aria-label="저장"
                          title="저장"
                        >
                          <SaveIcon />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="agent-settings-empty">설정을 불러오는 중입니다.</div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="panel">
              <div className="panel-head">
                <h3>Projects</h3>
              </div>
              {interactionBusy ? (
                <div className="panel-note">Project switch is unavailable while a turn is running.</div>
              ) : null}
              <div className="thread-list project-list">
                {projectItems.map((item) => (
                  <button
                    key={item.key}
                    className={`thread-item project-item ${item.key === activeProjectKey ? "active" : ""}`}
                    onClick={() => selectProject(item.key).catch(() => {})}
                    disabled={interactionBusy}
                    type="button"
                  >
                    <div className="thread-title">
                      {item.name || item.key}
                      {item.default ? <span className="project-pill">default</span> : null}
                    </div>
                    <div className="thread-sub">{item.key}</div>
                  </button>
                ))}
                {projectItems.length ? null : <div className="panel-note">No projects configured.</div>}
              </div>
            </div>
            <div className="panel threads-panel">
              <div className="panel-head">
                <h3>Threads</h3>
              </div>
              <div className="thread-list">
                {threadItems.map((item) => (
                  <button
                    key={item.id}
                    className={`thread-item ${normalizeThreadId(item.id) === normalizeThreadId(activeThread) ? "active" : ""}`}
                    onClick={() => viewThread(item.id)}
                    disabled={interactionBusy}
                    type="button"
                  >
                    <div className="thread-title">{item.title || "Untitled"}</div>
                    <div className="thread-sub">{item.id}</div>
                  </button>
                ))}
                {threadItems.length ? null : (
                  <div className="panel-note">No open threads.</div>
                )}
              </div>
            </div>
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
        {floatingAgentSettings === "guardian" ? (
          <div className="agent-floating-settings">
            <div className="agent-floating-settings-card">
              <div className="agent-settings-head">
                <strong>Guardian Rules TOML</strong>
                <button
                  className="agent-floating-settings-close"
                  type="button"
                  onClick={() => setFloatingAgentSettings("")}
                  disabled={settingsBusy}
                >
                  Close
                </button>
              </div>
              {floatingAgentConfig ? (
                <div className="agent-settings-form">
                  <label className="agent-field">
                    <span>Rules TOML</span>
                    <textarea
                      className="agent-field-textarea"
                      value={guardianRulesEditor}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setAgentConfigRawEditors((prev) => ({
                          ...prev,
                          [floatingAgentSettings]: nextValue,
                        }));
                      }}
                      disabled={settingsBusy}
                      spellCheck={false}
                    />
                    <span className="agent-field-help">
                      Only rules that already exist in `conf.toml` are active. If none are configured, commented examples from `conf.toml.example` are shown here.
                    </span>
                  </label>
                  <div className="agent-floating-settings-note">
                    Timeout, failure policy, and explainability stay in the left settings card.
                  </div>
                  <div className="agent-settings-actions">
                    <button
                      className="agent-settings-action"
                      type="button"
                      onClick={() => loadAgentConfig(floatingAgentSettings, { syncRulesEditor: true }).catch((err) => {
                        setAgentConfigError(err.message || "Failed to refresh settings.");
                      })}
                      disabled={settingsBusy}
                      aria-label="새로고침"
                      title="새로고침"
                    >
                      <RefreshIcon />
                    </button>
                    <button
                      className="agent-settings-action agent-settings-action-primary"
                      type="button"
                      onClick={() => saveAgentSettings(floatingAgentSettings, { includeRules: true })}
                      disabled={settingsBusy}
                      aria-label="저장"
                      title="저장"
                    >
                      <SaveIcon />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="agent-settings-empty">설정을 불러오는 중입니다.</div>
              )}
            </div>
          </div>
        ) : null}
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
        <div className="workspace-layout">
          <div className="center-pane">
            <WorkspacePreviewPanel workspacePreview={workspacePreview} onClose={() => setWorkspacePreview(null)} />
            <div className="chat" ref={chatRef}>
              <ApprovalStack
                approvalItems={approvalItems}
                approvalBusyId={approvalBusyId}
                onSubmitApproval={submitApproval}
                onClose={closeApproval}
              />
              <ChatMessageFeed renderItems={renderItems} />
            </div>
            <div className="composer">
              {activityDetail ? (
                <div className="activity-indicator composer-activity-indicator">{activityDetail}</div>
              ) : null}
              <div className="composer-inner">
                <div className="input-wrap">
              {paletteOpen ? (
                <div className="slash-panel" ref={paletteRef}>
                  {visiblePaletteItems.map((item, idx) => {
                    const absoluteIndex = paletteWindowStart + idx;
                    return (
                    <button
                      key={`${activeToken?.type || "t"}:${item}`}
                      className={`slash-item ${absoluteIndex === paletteSelectedIndex ? "active" : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyPaletteItem(item);
                      }}
                    >
                      {activeToken?.type === "project" ? "@" : activeToken?.type === "skill" ? "$" : ""}
                      {item}
                    </button>
                    );
                  })}
                </div>
              ) : null}
              <div className={`composer-input-shell mode-${collaborationMode}`}>
                <button
                  type="button"
                  className={`composer-mode mode-${collaborationMode}`}
                  disabled={composerLocked || modeSwitchBusy}
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => {
                    toggleComposerMode().catch(() => {});
                    focusComposer();
                  }}
                  title="Press Tab to toggle mode"
                  aria-label={`Collaboration mode ${collaborationMode}. Press Tab to toggle.`}
                >
                  <span className="composer-mode-label">{collaborationMode.toUpperCase()}</span>
                  <span className="composer-mode-key">TAB</span>
                </button>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  disabled={composerLocked}
                  onChange={(e) => {
                    composerFocusWantedRef.current = true;
                    rememberComposerSelection(e.currentTarget);
                    setInputForActiveThread(e.target.value);
                  }}
                  onFocus={(e) => {
                    composerFocusWantedRef.current = true;
                    rememberComposerSelection(e.currentTarget);
                  }}
                  onBlur={(e) => {
                    const now =
                      typeof performance !== "undefined" && typeof performance.now === "function"
                        ? performance.now()
                        : Date.now();
                    if (now - recentBackspaceAtRef.current <= 250) {
                      composerFocusWantedRef.current = true;
                      return;
                    }
                    composerFocusWantedRef.current = false;
                    rememberComposerSelection(e.currentTarget);
                  }}
                  onSelect={(e) => {
                    rememberComposerSelection(e.currentTarget);
                  }}
                  onKeyDown={(e) => {
                    if (composerLocked) {
                      return;
                    }
                    if (e.isComposing) {
                      return;
                    }
                    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
                    const ctrlKey = isMac ? e.metaKey : e.ctrlKey;
                    if (ctrlKey && (e.key === "c" || e.key === "C") && status === "running") {
                      e.preventDefault();
                      interrupt();
                      return;
                    }
                    composerFocusWantedRef.current = true;
                    rememberComposerSelection(e.currentTarget);
                    if (e.key === "Backspace") {
                      recentBackspaceAtRef.current =
                        typeof performance !== "undefined" && typeof performance.now === "function"
                          ? performance.now()
                          : Date.now();
                    }
                    if (e.key === "Tab" && !e.altKey && !e.ctrlKey && !e.metaKey) {
                      e.preventDefault();
                      toggleComposerMode().catch(() => {});
                      return;
                    }
                    if (paletteOpen && e.key === "ArrowDown") {
                      e.preventDefault();
                      setPaletteSelectedIndex((prev) => (prev + 1) % paletteItems.length);
                      return;
                    }
                    if (paletteOpen && e.key === "ArrowUp") {
                      e.preventDefault();
                      setPaletteSelectedIndex((prev) =>
                        (prev - 1 + paletteItems.length) % paletteItems.length
                      );
                      return;
                    }
                    if (paletteOpen && e.key === "Escape") {
                      e.preventDefault();
                      return;
                    }
                    if (e.key !== "Enter") {
                      return;
                    }
                    if (e.altKey || e.shiftKey) {
                      e.preventDefault();
                      const el = e.currentTarget;
                      const start = el.selectionStart ?? input.length;
                      const end = el.selectionEnd ?? input.length;
                      const next = `${input.slice(0, start)}\n${input.slice(end)}`;
                      setInputForActiveThread(next);
                      queueMicrotask(() => {
                        const pos = start + 1;
                        if (inputRef.current) {
                          inputRef.current.selectionStart = pos;
                          inputRef.current.selectionEnd = pos;
                        }
                      });
                      return;
                    }
                    if (paletteOpen) {
                      e.preventDefault();
                      applyPaletteItem(paletteItems[paletteSelectedIndex]);
                      return;
                    }
                    e.preventDefault();
                    sendMessage().catch(() => {});
                  }}
                  placeholder="Message..."
                />
              </div>
            </div>
            {status === "running" ? (
              <button className="composer-action composer-stop" onClick={interrupt} aria-label="Stop" title="Stop">
                <StopIcon />
              </button>
            ) : (
              <button className="composer-action composer-send" onClick={sendMessage} aria-label="Send" title="Send">
                <SendIcon />
              </button>
            )}
            {isCompactWorkspaceLayout ? (
              <button
                className={`composer-action composer-workspace-toggle ${isWorkspacePanelOpen ? "active" : ""}`}
                onClick={() => setIsWorkspacePanelOpen((current) => !current)}
                aria-label="Workspace files"
                title="Workspace files"
                type="button"
              >
                <FolderIcon open={isWorkspacePanelOpen} />
              </button>
            ) : null}
            <button
              className="composer-action composer-new-chat"
              onClick={() => startThread({ replaceCurrentTab: true }).catch(() => {})}
              aria-label="New chat"
              title="New chat"
              disabled={interactionBusy}
            >
              <NewChatIcon />
            </button>
          </div>
            </div>
            {isCompactWorkspaceLayout && isWorkspacePanelOpen ? workspacePanel : null}
          </div>
          {!isCompactWorkspaceLayout ? (
            <div className="workspace-panel-shell">
              <div
                className={`workspace-panel-resizer ${isResizingWorkspacePanel ? "active" : ""}`}
                onMouseDown={(event) => {
                  workspaceResizeRef.current = {
                    startX: event.clientX,
                    startWidth: workspacePanelWidth,
                  };
                  setIsResizingWorkspacePanel(true);
                }}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize workspace files panel"
              />
              {workspacePanel}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}


export default AuthenticatedApp;
