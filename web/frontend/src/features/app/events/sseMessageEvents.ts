import { normalizeThreadId } from "../../common/utils";
import { formatWebSearchAction } from "../../common/utils";
import { extractEventText, recordItemPhase } from "./sseEventUtils";

type MessageEventDeps = {
  appendMessageToThread: (threadId: string, message: Record<string, unknown>) => void;
  applyMessageMutationForThread: (
    threadId: string,
    mutate: (prev: Array<Record<string, unknown>>) => Array<Record<string, unknown>>
  ) => void;
  loadSessionSummary: () => Promise<void>;
  loadThreads: (options?: { projectKey?: string; projectTabId?: string; revealThreadId?: string }) => Promise<void>;
  loadWorkspaceStatus: () => Promise<void>;
  activeProjectKeyRef: { current: string };
  activeProjectTabIdRef: { current: string };
  streamedTurnIdsRef: { current: Record<string, boolean> };
  resolveThreadIdFromTurn: (candidateThreadId: unknown, turnId?: string) => string;
  itemPhaseByTurnRef: { current: Record<string, Record<string, string>> };
};

export function handleWebSearchItemEvent(data: Record<string, unknown>, deps: Pick<MessageEventDeps, "appendMessageToThread">) {
  const query = typeof data.query === "string" ? data.query.trim() : "";
  const actionText = formatWebSearchAction(data.action);
  if (!query && !actionText) {
    return;
  }
  deps.appendMessageToThread(normalizeThreadId(data.thread_id), {
    role: "system",
    kind: "web_search",
    threadId: normalizeThreadId(data.thread_id),
    turnId: typeof data.turn_id === "string" ? data.turn_id : "",
    itemId: typeof data.item_id === "string" ? data.item_id : "",
    text: query || "Web search",
    detail: actionText,
    streaming: false,
  });
}

export function handleImageGenerationItemEvent(data: Record<string, unknown>, deps: Pick<MessageEventDeps, "appendMessageToThread">) {
  const detailLines: string[] = [];
  const revisedPrompt = typeof data.revised_prompt === "string" ? data.revised_prompt.trim() : "";
  const savedPath = typeof data.saved_path === "string" ? data.saved_path.trim() : "";
  const statusText = typeof data.status === "string" ? data.status.trim() : "";
  if (statusText) {
    detailLines.push(`Status: ${statusText}`);
  }
  if (savedPath) {
    detailLines.push(`Saved to: ${savedPath}`);
  }
  deps.appendMessageToThread(normalizeThreadId(data.thread_id), {
    role: "system",
    kind: "image_generation",
    threadId: normalizeThreadId(data.thread_id),
    turnId: typeof data.turn_id === "string" ? data.turn_id : "",
    itemId: typeof data.item_id === "string" ? data.item_id : "",
    text: revisedPrompt || "Generated image",
    detail: detailLines.join("\n"),
    streaming: false,
  });
}

export function handleContextCompactedItemEvent(data: Record<string, unknown>, deps: Pick<MessageEventDeps, "appendMessageToThread">) {
  const text = typeof data.text === "string" && data.text.trim() ? data.text.trim() : "Context compacted";
  deps.appendMessageToThread(normalizeThreadId(data.thread_id), {
    role: "system",
    text,
    threadId: normalizeThreadId(data.thread_id),
    turnId: typeof data.turn_id === "string" ? data.turn_id : "",
    streaming: false,
  });
}

export function handleSystemMessageEvent(
  data: Record<string, unknown>,
  deps: Pick<MessageEventDeps, "appendMessageToThread" | "loadSessionSummary" | "loadWorkspaceStatus">
) {
  const text = typeof data.text === "string" ? data.text : "";
  if (!text) {
    return;
  }
  deps.appendMessageToThread(normalizeThreadId(data.thread_id), {
    role: "system",
    text,
    threadId: normalizeThreadId(data.thread_id),
    turnId: typeof data.turn_id === "string" ? data.turn_id : "",
    streaming: false,
  });
  deps.loadSessionSummary().catch(() => {});
  deps.loadWorkspaceStatus().catch(() => {});
}

export function handleFileChangeEvent(
  data: Record<string, unknown>,
  deps: Pick<MessageEventDeps, "appendMessageToThread" | "loadSessionSummary" | "loadWorkspaceStatus">
) {
  const summary = typeof data.summary === "string" ? data.summary : (typeof data.text === "string" ? data.text : "");
  const files = Array.isArray(data.files) ? data.files : [];
  const diff = typeof data.diff === "string" ? data.diff : "";
  const threadId = normalizeThreadId(data.thread_id);
  const turnId = typeof data.turn_id === "string" ? data.turn_id : "";
  if (!summary && files.length === 0 && !diff) {
    return;
  }
  deps.appendMessageToThread(threadId, {
    role: "system",
    text: summary || "Applied patch changes",
    files,
    diff,
    threadId,
    turnId,
    kind: "file_change",
    streaming: false,
  });
  deps.loadWorkspaceStatus().catch(() => {});
  deps.loadSessionSummary().catch(() => {});
}

export async function handleThreadsChangedEvent(
  data: Record<string, unknown>,
  deps: Pick<MessageEventDeps, "loadSessionSummary" | "loadThreads" | "activeProjectKeyRef" | "activeProjectTabIdRef">
) {
  const revealThreadId = normalizeThreadId(data.thread_id);
  const eventProjectKey = typeof data.project_key === "string" && data.project_key.trim()
    ? data.project_key.trim()
    : "";
  const projectKey = eventProjectKey || deps.activeProjectKeyRef.current;
  const projectTabId = projectKey === deps.activeProjectKeyRef.current
    ? deps.activeProjectTabIdRef.current
    : undefined;
  await deps.loadSessionSummary();
  await deps.loadThreads({
    projectKey,
    ...(projectTabId ? { projectTabId } : {}),
    ...(revealThreadId ? { revealThreadId } : {}),
  });
}

export function handleAppEvent(data: Record<string, unknown>, deps: MessageEventDeps) {
  const method = typeof data.method === "string" ? data.method : "";
  if (["thread/started", "thread/status/changed", "thread/closed", "subagents_changed"].includes(method)) {
    deps.loadSessionSummary().catch(() => {});
  }
  if (data.method === "item/started" || data.method === "item/completed") {
    recordItemPhase(data, deps.itemPhaseByTurnRef);
  }
  if (method !== "item/completed") {
    return;
  }
  const params = data.params as Record<string, unknown> | undefined;
  const item = params?.item as Record<string, unknown> | undefined;
  const itemType = typeof item?.type === "string" ? item.type.toLowerCase() : "";
  if (!["agentmessage", "assistantmessage", "message"].includes(itemType)) {
    return;
  }
  const text = extractEventText(data);
  if (!text) {
    return;
  }
  const turnId = typeof data.turn_id === "string" && data.turn_id ? data.turn_id : "";
  const threadId = deps.resolveThreadIdFromTurn(data.thread_id, turnId);
  if (!threadId && turnId) {
    return;
  }
  if (turnId && deps.streamedTurnIdsRef.current[turnId]) {
    return;
  }
  deps.applyMessageMutationForThread(threadId, (prev) => {
    const copy = [...prev];
    const last = copy[copy.length - 1];
    if (last && last.role === "assistant" && last.streaming && (((last.turnId as string) || "") === turnId || !turnId)) {
      last.text = `${String(last.text || "")}${text}`;
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
}
