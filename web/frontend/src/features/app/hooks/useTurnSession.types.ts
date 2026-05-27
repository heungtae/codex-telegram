export type TurnSessionArgs = {
  me: Record<string, unknown> | null;
  turnNotificationEnabled: boolean;
  loadProjects: () => Promise<void>;
  loadThreads: (options?: {
    projectKey?: string;
    projectTabId?: string;
    ensureDefaultTab?: boolean;
    resetThreadTabs?: boolean;
  }) => Promise<void>;
  loadSkillSuggestions: () => Promise<void>;
  loadSessionSummary: () => Promise<void>;
  loadApprovals: () => Promise<void>;
  loadWorkspaceStatus: () => Promise<void>;
  refreshWorkspaceBrowser: () => Promise<void>;
  activeProjectKey: string;
  activeProjectTabId: string;
  activeThreadRef: { current: string };
  activeProjectKeyRef: { current: string };
  activeProjectTabIdRef: { current: string };
  streamedTurnIdsRef: { current: Record<string, boolean> };
  assistantItemCompletedByTurnRef: { current: Record<string, boolean> };
  itemPhaseByTurnRef: { current: Record<string, Record<string, string>> };
  turnThreadIdRef: { current: Record<string, string> };
  reasoningStateRef: { current: Record<string, unknown> };
  debugLog: (...args: unknown[]) => void;
  debugError: (...args: unknown[]) => void;
  appendMessageToThread: (threadId: string, message: Record<string, unknown>) => void;
  applyMessageMutationForThread: (
    threadId: string,
    mutate: (prev: Array<Record<string, unknown>>) => Array<Record<string, unknown>>
  ) => void;
  appendReasoningStatus: (payload: Record<string, unknown>) => void;
  completeReasoning: (payload: Record<string, unknown>) => void;
  upsertPlanMessage: (mode: "append" | "final", payload: Record<string, unknown>) => void;
  upsertPlanChecklist: (payload: Record<string, unknown>) => void;
  setStatusForThread: (threadId: string, next: string) => void;
  setActivityDetailForThread: (threadId: string, detail: string) => void;
  setMessages: (
    updater: Array<Record<string, unknown>> | ((prev: Array<Record<string, unknown>>) => Array<Record<string, unknown>>)
  ) => void;
  updateThreadTabState: (threadId: string, patch: Record<string, unknown>) => void;
  playTurnNotification: () => void;
  setApprovalBusyId: (value: number | null) => void;
  setApprovalItems: (items: Array<Record<string, unknown>>) => void;
  setCollaborationMode: (mode: string) => void;
  normalizeCollaborationMode: (raw: unknown) => "build" | "plan";
  resolveThreadIdFromTurn: (candidateThreadId: unknown, turnId?: string) => string;
};
