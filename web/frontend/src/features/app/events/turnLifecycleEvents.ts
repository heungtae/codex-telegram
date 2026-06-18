type TurnLifecycleDeps = {
  activeThreadRef: { current: string };
  streamedTurnIdsRef: { current: Record<string, boolean> };
  assistantItemCompletedByTurnRef: { current: Record<string, boolean> };
  turnThreadIdRef: { current: Record<string, string> };
  reasoningStateRef: { current: Record<string, unknown> };
  updateThreadTabState: (threadId: string, patch: Record<string, unknown>) => void;
  setStatusForThread: (threadId: string, next: string) => void;
  setActivityDetailForThread: (threadId: string, detail: string) => void;
  setMessages: (
    updater: Array<Record<string, unknown>> | ((prev: Array<Record<string, unknown>>) => Array<Record<string, unknown>>)
  ) => void;
  setCollaborationMode: (mode: string) => void;
  normalizeCollaborationMode: (raw: unknown) => "build" | "plan";
  resolveThreadIdFromTurn: (candidateThreadId: unknown, turnId?: string) => string;
  playTurnNotification: () => void;
  appendMessageToThread: (threadId: string, message: Record<string, unknown>) => void;
  loadProjects: () => Promise<void>;
  loadSessionSummary: () => Promise<void>;
};

export function handleTurnStartedEvent(data: Record<string, unknown>, deps: TurnLifecycleDeps) {
  const turnId = typeof data.turn_id === "string" ? data.turn_id : "";
  const eventThreadId = deps.resolveThreadIdFromTurn(data.thread_id, turnId);
  if (turnId && eventThreadId) {
    deps.turnThreadIdRef.current[turnId] = eventThreadId;
  }
  deps.updateThreadTabState(eventThreadId, { status: "running", hasUnreadCompletion: false });
  deps.setStatusForThread(eventThreadId, "running");
  deps.setActivityDetailForThread(eventThreadId, "");
  const params = data.params as Record<string, unknown> | undefined;
  const actualMode = params?.collaboration_mode_kind || params?.collaborationModeKind;
  if (typeof actualMode === "string") {
    deps.setCollaborationMode(deps.normalizeCollaborationMode(actualMode));
  }
  deps.reasoningStateRef.current = {};
  if (eventThreadId === deps.activeThreadRef.current) {
    deps.setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
  }
}

export function handleTurnFailedEvent(data: Record<string, unknown>, deps: TurnLifecycleDeps) {
  const turnId = typeof data.turn_id === "string" ? data.turn_id : "";
  if (turnId) {
    delete deps.streamedTurnIdsRef.current[turnId];
    delete deps.assistantItemCompletedByTurnRef.current[turnId];
  }
  const failedThreadId = deps.resolveThreadIdFromTurn(data.thread_id, turnId);
  if (turnId) {
    delete deps.turnThreadIdRef.current[turnId];
  }
  const shouldNotify = failedThreadId && failedThreadId !== deps.activeThreadRef.current;
  deps.updateThreadTabState(failedThreadId, {
    status: "failed",
    hasUnreadCompletion: failedThreadId ? shouldNotify : true,
  });
  if (shouldNotify) {
    deps.playTurnNotification();
  }
  const text = typeof data.text === "string" ? data.text : "Turn failed.";
  const threadId = deps.resolveThreadIdFromTurn(data.thread_id, turnId);
  deps.setStatusForThread(threadId, "idle");
  deps.setActivityDetailForThread(threadId, "");
  deps.reasoningStateRef.current = {};
  deps.appendMessageToThread(threadId, { role: "system", text, threadId, turnId, streaming: false });
  deps.loadProjects().catch(() => {});
  deps.loadSessionSummary().catch(() => {});
}

export function handleTurnCancelledEvent(data: Record<string, unknown>, deps: TurnLifecycleDeps) {
  const turnId = typeof data.turn_id === "string" ? data.turn_id : "";
  if (turnId) {
    delete deps.streamedTurnIdsRef.current[turnId];
    delete deps.assistantItemCompletedByTurnRef.current[turnId];
  }
  const cancelledThreadId = deps.resolveThreadIdFromTurn(data.thread_id, turnId);
  if (turnId) {
    delete deps.turnThreadIdRef.current[turnId];
  }
  const shouldNotify = cancelledThreadId && cancelledThreadId !== deps.activeThreadRef.current;
  deps.updateThreadTabState(cancelledThreadId, {
    status: "cancelled",
    hasUnreadCompletion: cancelledThreadId ? shouldNotify : true,
  });
  if (shouldNotify) {
    deps.playTurnNotification();
  }
  deps.setStatusForThread(cancelledThreadId, "idle");
  deps.setActivityDetailForThread(cancelledThreadId, "");
  deps.reasoningStateRef.current = {};
  deps.loadProjects().catch(() => {});
  deps.loadSessionSummary().catch(() => {});
}
