import { buildProjectTabId, normalizeThreadId } from "../../common/utils";
import type { UseProjectThreadTabsArgs } from "./useProjectThreadTabs.types";

export default function useProjectThreadTabs(args: UseProjectThreadTabsArgs) {
  const {
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
  } = args;

  const upsertProjectTab = (project: Record<string, unknown>, options: { forceNew?: boolean } = {}) => {
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

  const setActiveThreadForProjectTab = (projectTabId: string, threadId: string) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    setActiveThreadTabIdByProjectTabId((prev) => ({ ...prev, [projectTabId]: normalizedThreadId }));
    if (projectTabId === activeProjectTabId) {
      setActiveThread(normalizedThreadId);
    }
  };

  const openThreadInProjectTab = (projectTabId: string, thread: Record<string, unknown>) => {
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

  const updateThreadTabState = (threadId: string, patch: Record<string, unknown>) => {
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

  const closeProjectTab = (projectTabId: string) => {
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

  return {
    upsertProjectTab,
    setActiveThreadForProjectTab,
    openThreadInProjectTab,
    updateThreadTabState,
    closeProjectTab,
  };
}
