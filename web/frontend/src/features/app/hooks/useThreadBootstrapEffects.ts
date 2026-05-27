/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect } from "react";

export default function useThreadBootstrapEffects({
  loadThreads,
  activeProjectKey,
  activeProjectTabId,
  resolveCurrentThreadId,
  setActiveThreadForProjectTab,
  restoreWorkspaceForThread,
  viewThread,
  setMessages,
  loadSessionSummary,
}) {
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
    loadThreads({
      projectKey: activeProjectKey,
      projectTabId: activeProjectTabId,
      ensureDefaultTab: false,
    }).catch(() => {});
  }, [activeProjectTabId]);
}
