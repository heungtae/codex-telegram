export function handleTurnCompletedWorkspaceRefresh({
  data,
  activeThreadId,
  activeProjectKey,
  activeProjectTabId,
  refreshWorkspaceBrowser,
  loadThreads,
  loadProjects,
  loadSessionSummary,
  updateThreadTabState,
  playTurnNotification,
  interruptedThreadIdRef,
  setStatusForThread,
  setActivityDetailForThread,
  setMessages,
  streamedTurnIdsRef,
  assistantItemCompletedByTurnRef,
  turnThreadIdRef,
  resolveThreadIdFromTurn,
}) {
  if (!data) {
    return;
  }
  const turnId = typeof data?.turn_id === "string" ? data.turn_id : "";
  const completedThreadId = resolveThreadIdFromTurn(data?.thread_id, turnId);
  if (turnId) {
    delete turnThreadIdRef.current[turnId];
  }
  const wasInterrupted =
    interruptedThreadIdRef &&
    completedThreadId &&
    interruptedThreadIdRef.current === completedThreadId;
  if (wasInterrupted) {
    interruptedThreadIdRef.current = "";
  }
  const shouldNotify = !wasInterrupted && completedThreadId && completedThreadId !== activeThreadId;
  updateThreadTabState(completedThreadId, {
    status: wasInterrupted ? "cancelled" : "completed",
    hasUnreadCompletion: completedThreadId ? shouldNotify : true,
  });
  if (shouldNotify) {
    playTurnNotification(completedThreadId, "completed");
  }
  setStatusForThread(completedThreadId, "idle");
  setActivityDetailForThread(completedThreadId, "");
  if (completedThreadId === activeThreadId) {
    setMessages((prev) => prev.map((m) => ({ ...m, streaming: false })));
  }
  if (turnId) {
    delete streamedTurnIdsRef.current[turnId];
    delete assistantItemCompletedByTurnRef.current[turnId];
  }
  loadThreads({
    projectKey: activeProjectKey,
    projectTabId: activeProjectTabId,
  }).catch(() => {});
  loadProjects().catch(() => {});
  loadSessionSummary().catch(() => {});
  refreshWorkspaceBrowser().catch(() => {});
}
