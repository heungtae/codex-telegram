import { normalizeThreadId } from "../../common/utils";
import { resolveProjectTabThreadId } from "../state/projectTabThreads";
import type { ThreadSessionArgs } from "./useThreadSession.types";

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

  const normalizeThreadMessages = (result: Record<string, unknown>, normalizedThreadId: string) => {
    const messages = Array.isArray(result?.messages) ? result.messages : [];
    const list = messages.length > 0
      ? messages
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
        })
      : [
        {
          role: "assistant",
          text: String(result?.text ?? ""),
          threadId: normalizeThreadId(String(result?.thread_id ?? "")) || normalizedThreadId,
          turnId: typeof result?.turn_id === "string" ? result.turn_id : "",
          streaming: false,
        },
      ];
    return list;
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

  const viewThread = async (threadId: string) => {
    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
    const normalizedThreadId = normalizeThreadId(threadId);
    setActiveThread(normalizedThreadId);
    if (activeProjectTabId) {
      const threadInfo = threadItems.find((item) => normalizeThreadId(String(item?.id ?? "")) === normalizedThreadId);
      openThreadInProjectTab(activeProjectTabId, {
        id: normalizedThreadId,
        title: typeof threadInfo?.title === "string" ? threadInfo.title : normalizedThreadId,
      });
      updateThreadTabState(normalizedThreadId, { hasUnreadCompletion: false });
    }
    const restored = restoreThreadMessages(normalizedThreadId);
    if (!restored) {
      const rows = Array.isArray(threadTabsByProjectTabId[activeProjectTabId])
        ? threadTabsByProjectTabId[activeProjectTabId]
        : [];
      const threadTab = rows.find((tab) => normalizeThreadId(String(tab.id ?? "")) === normalizedThreadId);
      const isRunning = threadTab?.status === "running";
      if (!isRunning) {
        setMessages([]);
        await syncThreadMessagesFromServer(normalizedThreadId, { applyToVisible: true });
      }
    }
  };

  const loadThreads = async (
    options: {
      projectKey?: string;
      projectTabId?: string;
      ensureDefaultTab?: boolean;
      resetThreadTabs?: boolean;
    } = {}
  ) => {
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
          const createdThreadId = normalizeThreadId(String(created?.thread_id ?? ""));
          if (createdThreadId) {
            openThreadInProjectTab(projectTabId, { id: createdThreadId, title: createdThreadId });
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

  const startThread = async (options: { replaceCurrentTab?: boolean } = {}) => {
    const replaceCurrentTab = !!options.replaceCurrentTab;
    let nextThreadId = "";
    if (activeProjectKey) {
      const result = await api("/api/projects/open-thread", {
        method: "POST",
        body: JSON.stringify({ project_key: activeProjectKey }),
      });
      nextThreadId = normalizeThreadId(String(result?.thread_id ?? ""));
      if (activeProjectTabId && nextThreadId) {
        const currentThreadTabId = normalizeThreadId(
          activeThreadTabIdByProjectTabId[activeProjectTabId] || activeThread
        );
        if (replaceCurrentTab && currentThreadTabId) {
          setThreadTabsByProjectTabId((prev) => {
            const rows = Array.isArray(prev[activeProjectTabId]) ? prev[activeProjectTabId] : [];
            const index = rows.findIndex((row) => normalizeThreadId(String(row.id ?? "")) === currentThreadTabId);
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
      if (activeProjectTabId) {
        setActiveThreadForProjectTab(activeProjectTabId, nextThreadId);
      }
    } else {
      await loadSessionSummary();
    }
    await loadThreads({ projectKey: activeProjectKey, projectTabId: activeProjectTabId });
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
    selectProject,
    viewThread,
    runCommand,
  };
}
