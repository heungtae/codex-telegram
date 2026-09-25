import { normalizeThreadId } from "../../common/utils";
import { resolveProjectTabThreadId } from "../state/projectTabThreads";
import { replaceThreadInTab, upsertThreadTab, removeThreadsOwnedByTab } from "../state/threadTabOps";
type ThreadSessionArgs = {
  api: (path: string, options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  me: Record<string, unknown> | null;
  activeProjectKey: string;
  activeProjectTabId: string;
  activeThread: string;
  isMobileLayout: boolean;
  interactionBusy: boolean;
  projectTabs: Array<Record<string, unknown>>;
  projectItems: Array<Record<string, unknown>>;
  threadItems: Array<Record<string, unknown>>;
  threadTabsByProjectTabId: Record<string, Array<Record<string, unknown>>>;
  activeThreadTabIdByProjectTabId: Record<string, string>;
  threadProjectTabIdByThreadId: Record<string, string>;
  initialLoadRef: { current: boolean };
  activeThreadRef: { current: string };
  pendingComposerFocusRef: { current: boolean };
  turnThreadIdRef: { current: Record<string, string> };
  setThreadItems: (items: Array<Record<string, unknown>>) => void;
  setProjectItems: (items: Array<Record<string, unknown>>) => void;
  setSessionSummary: (summary: Record<string, unknown>) => void;
  setProjectTabs: (updater: (prev: Array<Record<string, unknown>>) => Array<Record<string, unknown>>) => void;
  setThreadTabsByProjectTabId: (updater: (prev: Record<string, Array<Record<string, unknown>>>) => Record<string, Array<Record<string, unknown>>>) => void;
  setThreadProjectTabIdByThreadId: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  setActiveThreadTabIdByProjectTabId: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  setActiveProjectTabId: (tabId: string) => void;
  setActiveThread: (threadId: string) => void;
  setMessagesByThreadId: (updater: (prev: Record<string, Array<Record<string, unknown>>>) => Record<string, Array<Record<string, unknown>>>) => void;
  setMessages: (updater: Array<Record<string, unknown>> | ((prev: Array<Record<string, unknown>>) => Array<Record<string, unknown>>)) => void;
  setStatus: (next: string | ((current: string) => string)) => void;
  setStatusForThread: (threadId: string, next: string) => void;
  setStatusForActiveThread: (next: string) => void;
  setCollaborationMode: (mode: string) => void;
  setIsSidebarOpen: (open: boolean) => void;
  setPendingProjectTarget: (target: string) => void;
  setIsProjectModeModalOpen: (open: boolean) => void;
  appendMessageToThread: (threadId: string, message: Record<string, unknown>) => void;
  restoreThreadMessages: (threadId: string) => boolean;
  updateThreadUi: (threadId: string, patch: Record<string, unknown>) => void;
  syncThreadMessagesFromServerImpl?: (threadId: string, options?: { applyToVisible?: boolean }) => Promise<void>;
  upsertProjectTab: (project: Record<string, unknown>, options?: { forceNew?: boolean }) => string;
  openThreadInProjectTab: (projectTabId: string, thread: Record<string, unknown>) => string;
  setActiveThreadForProjectTab: (projectTabId: string, threadId: string) => void;
  updateThreadTabState: (threadId: string, patch: Record<string, unknown>) => void;
  ensureWorkspaceBucket: (threadId: string) => void;
  removeWorkspaceBucket: (threadId: string) => void;
  normalizeCollaborationMode: (raw: unknown) => "build" | "plan";
};

type OpenInTelegramDeps = {
  threadId: string;
  activeProjectKey: string;
  activeProjectTabId: string;
  api: ThreadSessionArgs["api"];
  loadSessionSummary: () => Promise<void>;
  loadThreads: (options: { projectKey?: string; projectTabId?: string; revealThreadId?: string }) => Promise<void>;
  viewThread?: (threadId: string, projectTabId?: string) => Promise<void>;
};

export function upsertThreadSummary(items: Array<Record<string, unknown>>, threadId: string): Array<Record<string, unknown>> {
  const normalizedThreadId = normalizeThreadId(threadId);
  if (!normalizedThreadId) {
    return items;
  }
  if (items.some((item) => normalizeThreadId(String(item?.id ?? "")) === normalizedThreadId)) {
    return items;
  }
  return [{ id: normalizedThreadId, title: normalizedThreadId }, ...items];
}

export function normalizeThreadMessages(
  result: Record<string, unknown>,
  normalizedThreadId: string,
): Array<Record<string, unknown>> {
  const messages = Array.isArray(result?.messages) ? result.messages : [];
  if (messages.length > 0) {
    return messages
      .filter((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).text === "string" && String((item as Record<string, unknown>).text).trim())
      .map((item) => {
        const row = item as Record<string, unknown>;
        return {
          role: row.role === "user" ? "user" : row.role === "assistant" ? "assistant" : "system",
          text: String(row.text ?? ""),
          variant: row.variant === "subagent" ? "subagent" : "",
          kind: row.kind === "plan" ? "plan" : "",
          threadId: normalizeThreadId(String(row.thread_id ?? "")) || normalizedThreadId,
          turnId: typeof row.turn_id === "string" ? row.turn_id : "",
          streaming: false,
        };
      });
  }
  return [
    {
      role: "assistant",
      text: String(result?.text ?? ""),
      threadId: normalizeThreadId(String(result?.thread_id ?? "")) || normalizedThreadId,
      turnId: typeof result?.turn_id === "string" ? result.turn_id : "",
      streaming: false,
    },
  ];
}

export async function openThreadInTelegramForProject({
  threadId,
  activeProjectKey,
  activeProjectTabId,
  api,
  loadSessionSummary,
  loadThreads,
  viewThread,
}: OpenInTelegramDeps) {
  const normalizedThreadId = normalizeThreadId(threadId);
  if (!normalizedThreadId) {
    return;
  }
  await api("/api/telegram/open-thread", {
    method: "POST",
    body: JSON.stringify({
      thread_id: normalizedThreadId,
      project_key: activeProjectKey || "",
    }),
  });
  await loadSessionSummary();
  await loadThreads({
    projectKey: activeProjectKey,
    projectTabId: activeProjectTabId,
    revealThreadId: normalizedThreadId,
  });
  await viewThread?.(normalizedThreadId, activeProjectTabId);
}

export default function useThreadSession(args: ThreadSessionArgs) {
  const {
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
  } = args;

  const resolveCurrentThreadId = (projectTabId = activeProjectTabId) => {
    return resolveProjectTabThreadId({
      projectTabId,
      activeThreadId: activeThread,
      threadProjectTabIdByThreadId,
      activeThreadTabIdByProjectTabId,
      threadTabsByProjectTabId,
    });
  };

  const syncThreadMessagesFromServer = async (
    threadId: string,
    options: { applyToVisible?: boolean } = {}
  ) => {
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

  const viewThread = async (threadId: string, overrideProjectTabId?: string) => {
    const resolvedProjectTabId = overrideProjectTabId ?? activeProjectTabId;
    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
    const normalizedThreadId = normalizeThreadId(threadId);
    setActiveThread(normalizedThreadId);
    if (resolvedProjectTabId) {
      const threadInfo = threadItems.find((item) => normalizeThreadId(String(item?.id ?? "")) === normalizedThreadId);
      openThreadInProjectTab(resolvedProjectTabId, {
        id: normalizedThreadId,
        title: typeof threadInfo?.title === "string" ? threadInfo.title : normalizedThreadId,
      });
      updateThreadTabState(normalizedThreadId, { hasUnreadCompletion: false, status: "idle" });
    }
    const restored = restoreThreadMessages(normalizedThreadId);
    if (!restored) {
      const rows = Array.isArray(threadTabsByProjectTabId[resolvedProjectTabId])
        ? threadTabsByProjectTabId[resolvedProjectTabId]
        : [];
      const threadTab = rows.find((tab) => normalizeThreadId(String(tab.id ?? "")) === normalizedThreadId);
      const isRunning = threadTab?.status === "running";
      if (!isRunning) {
        setMessages([]);
        await syncThreadMessagesFromServer(normalizedThreadId, { applyToVisible: true });
      }
    }
  };

  const openThreadInTelegram = async (threadId: string) => {
    await openThreadInTelegramForProject({
      threadId,
      activeProjectKey,
      activeProjectTabId,
      api,
      loadSessionSummary,
      loadThreads,
      viewThread,
    });
  };

  const loadThreads = async (
    options: {
      projectKey?: string;
      projectTabId?: string;
      ensureDefaultTab?: boolean;
      resetThreadTabs?: boolean;
      revealThreadId?: string;
    } = {}
  ) => {
    const projectKey = typeof options.projectKey === "string" ? options.projectKey : (activeProjectKey || "");
    let projectTabId = typeof options.projectTabId === "string" ? options.projectTabId : (activeProjectTabId || "");
    const ensureDefaultTab = !!options.ensureDefaultTab;
    const resetThreadTabs = !!options.resetThreadTabs;
    const revealThreadId = normalizeThreadId(options.revealThreadId);
    if (revealThreadId && projectKey) {
      const existingProjectTab = projectTabs.find((tab) => tab?.key === projectKey);
      const existingProjectTabId = typeof existingProjectTab?.id === "string" ? existingProjectTab.id : "";
      if (existingProjectTabId) {
        projectTabId = existingProjectTabId;
      } else {
        const project = projectItems.find((item) => item?.key === projectKey) || { key: projectKey, name: projectKey, path: "" };
        projectTabId = upsertProjectTab(project);
      }
    }
    const configuredThreadsLimit = Number.parseInt(String(me?.threads_list_limit ?? "20"), 10);
    const threadsLimit = Number.isFinite(configuredThreadsLimit)
      ? Math.max(1, Math.min(100, configuredThreadsLimit))
      : 20;
    const query = new URLSearchParams({ limit: String(threadsLimit), offset: "0", archived: "false" });
    if (projectKey) {
      query.set("project_key", projectKey);
    }
    const summaries = await api(`/api/threads/summaries?${query.toString()}`);
    const rawItems = Array.isArray(summaries.items) ? summaries.items : [];
    const items = revealThreadId ? upsertThreadSummary(rawItems, revealThreadId) : rawItems;
    if (typeof console !== "undefined" && typeof console.debug === "function") {
      console.debug("[threads] refreshed", {
        projectKey,
        projectTabId,
        count: items.length,
        revealThreadId,
      });
    }
    if (!projectTabId || projectTabId === activeProjectTabId || revealThreadId) {
      setThreadItems(items);
    }
    if (projectTabId && revealThreadId) {
      const revealedThread = items.find((item) => normalizeThreadId(String(item?.id ?? "")) === revealThreadId) || {
        id: revealThreadId,
        title: revealThreadId,
      };
      setThreadTabsByProjectTabId((prev) => {
        const title = typeof revealedThread?.title === "string" && revealedThread.title
          ? revealedThread.title
          : revealThreadId;
        return upsertThreadTab(prev, projectTabId, revealThreadId, title);
      });
      setThreadProjectTabIdByThreadId((prev) => ({ ...prev, [revealThreadId]: projectTabId }));
      ensureWorkspaceBucket(revealThreadId);
      setActiveProjectTabId(projectTabId);
      setActiveThreadTabIdByProjectTabId((prev) => ({ ...prev, [projectTabId]: revealThreadId }));
      setActiveThread(revealThreadId);
      setMessages([]);
      setStatus("idle");
      pendingComposerFocusRef.current = true;
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
          const createdThreadId = normalizeThreadId(String(created?.thread_id ?? ""));
          if (createdThreadId) {
            openThreadInProjectTab(projectTabId, { id: createdThreadId });
            if (projectTabId === activeProjectTabId) {
              viewThread(createdThreadId).catch(() => {});
            }
          }
        }
      } else if (!normalizeThreadId(activeThreadTabIdByProjectTabId[projectTabId])) {
        const defaultThreadId = normalizeThreadId(String(opened[0]?.id ?? ""));
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
            name: typeof matched.name === "string" && matched.name ? matched.name : String(tab.name ?? ""),
            path: typeof matched.path === "string" ? matched.path : String(tab.path ?? ""),
          };
        })
      );
    }
  };

  const loadSessionSummary = async () => {
    const summary = await api("/api/session/summary");
    setSessionSummary(summary);
    const summaryThreadId = normalizeThreadId(String(summary?.active_thread_id ?? ""));
    const hasActiveTurn = !!summary?.active_turn_id;
    setThreadTabsByProjectTabId((prev) => {
      const next: Record<string, Array<Record<string, unknown>>> = {};
      for (const [projectTabId, rows] of Object.entries(prev)) {
        next[projectTabId] = (Array.isArray(rows) ? rows : []).map((row) => {
          const rowThreadId = normalizeThreadId(String(row?.id ?? ""));
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

  const startThread = async (
    options: { replaceCurrentTab?: boolean } = {},
    overrideProjectTabId?: string,
    overrideProjectKey?: string
  ) => {
    const replaceCurrentTab = !!options.replaceCurrentTab;
    const resolvedProjectKey = overrideProjectKey ?? activeProjectKey;
    const resolvedProjectTabId = overrideProjectTabId ?? activeProjectTabId;
    let nextThreadId = "";
    if (resolvedProjectKey) {
      const result = await api("/api/projects/open-thread", {
        method: "POST",
        body: JSON.stringify({ project_key: resolvedProjectKey }),
      });
      nextThreadId = normalizeThreadId(String(result?.thread_id ?? ""));
      if (resolvedProjectTabId && nextThreadId) {
        const currentThreadTabId = normalizeThreadId(
          activeThreadTabIdByProjectTabId[resolvedProjectTabId] || activeThread
        );
        if (replaceCurrentTab && currentThreadTabId) {
          setThreadTabsByProjectTabId((prev) =>
            replaceThreadInTab(prev, resolvedProjectTabId, currentThreadTabId, nextThreadId)
          );
          setThreadProjectTabIdByThreadId((prev) => {
            const next = { ...prev };
            delete next[currentThreadTabId];
            next[nextThreadId] = resolvedProjectTabId;
            return next;
          });
          removeWorkspaceBucket(currentThreadTabId);
          ensureWorkspaceBucket(nextThreadId);
          setActiveThreadForProjectTab(resolvedProjectTabId, nextThreadId);
        } else {
          openThreadInProjectTab(resolvedProjectTabId, { id: nextThreadId });
        }
      }
    } else {
      const result = await api("/api/threads/start", { method: "POST", body: "{}" });
      const resultMeta = result?.meta && typeof result.meta === "object"
        ? (result.meta as Record<string, unknown>)
        : {};
      nextThreadId = normalizeThreadId(String(resultMeta.thread_id ?? ""));
    }
    setMessages([]);
    setStatus("idle");
    pendingComposerFocusRef.current = true;
    if (nextThreadId) {
      setActiveThread(nextThreadId);
      if (resolvedProjectTabId) {
        setActiveThreadForProjectTab(resolvedProjectTabId, nextThreadId);
      }
    } else {
      await loadSessionSummary();
    }
    await loadThreads({ projectKey: resolvedProjectKey, projectTabId: resolvedProjectTabId });
  };

  const selectProject = async (target: string, forcedMode = "") => {
    const normalizedTarget = typeof target === "string" ? target.trim() : "";
    if (!normalizedTarget || interactionBusy) {
      return;
    }
    const existingTabForTarget = projectTabs.find((tab) => tab.key === normalizedTarget);
    if (!forcedMode && existingTabForTarget) {
      setActiveProjectTabId(String(existingTabForTarget.id ?? ""));
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
                  key: String(nextProject.key ?? ""),
                  name: String(nextProject.name ?? nextProject.key ?? ""),
                  path: String(nextProject.path ?? ""),
                }
              : tab
          )
        );
        setThreadTabsByProjectTabId((prev) => ({ ...prev, [activeProjectTabId]: [] }));
        setActiveThreadTabIdByProjectTabId((prev) => ({ ...prev, [activeProjectTabId]: "" }));
        const ownedThreads = Array.isArray(threadTabsByProjectTabId[activeProjectTabId])
          ? threadTabsByProjectTabId[activeProjectTabId].map((row) => normalizeThreadId(String(row.id ?? ""))).filter(Boolean)
          : [];
        ownedThreads.forEach((threadId) => removeWorkspaceBucket(threadId));
        setThreadProjectTabIdByThreadId((prev) =>
          removeThreadsOwnedByTab(prev, activeProjectTabId)
        );
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
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: err instanceof Error ? err.message : "Failed to switch project.",
          threadId: normalizeThreadId(activeThread),
          turnId: "",
          streaming: false,
        },
      ]);
    }
  };

  const runCommand = async (line: string) => {
    const cmd = (line || "").trim();
    if (!cmd) {
      return;
    }
    const commandThreadId = resolveCurrentThreadId();
    appendMessageToThread(commandThreadId, { role: "user", text: cmd, turnId: "" });
    setStatusForThread(commandThreadId, "running");
    const result = await api("/api/command", {
      method: "POST",
      body: JSON.stringify({ command_line: cmd }),
    });
    const resultMeta = result?.meta && typeof result.meta === "object"
      ? (result.meta as Record<string, unknown>)
      : {};
    if (resultMeta.collaboration_mode) {
      setCollaborationMode(normalizeCollaborationMode(resultMeta.collaboration_mode));
    }
    const responseThreadId = normalizeThreadId(String(resultMeta.thread_id ?? "")) || commandThreadId;
    if (responseThreadId && activeProjectTabId) {
      const threadInfo = threadItems.find((item) => normalizeThreadId(String(item?.id ?? "")) === responseThreadId);
      openThreadInProjectTab(activeProjectTabId, {
        id: responseThreadId,
        title: typeof threadInfo?.title === "string" ? threadInfo.title : responseThreadId,
      });
    }
    appendMessageToThread(responseThreadId, {
      role: "assistant",
      text: String(result.text ?? ""),
      threadId: responseThreadId,
      turnId: typeof resultMeta.turn_id === "string" ? resultMeta.turn_id : "",
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

  return {
    loadThreads,
    loadProjects,
    loadSessionSummary,
    resolveCurrentThreadId,
    syncThreadMessagesFromServer,
    startThread,
    openThreadInTelegram,
    selectProject,
    viewThread,
    runCommand,
  };
}
