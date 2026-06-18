import { extractEventItemId, extractEventText } from "./sseEventUtils";

type TurnDeltaDeps = {
  itemPhaseByTurnRef: { current: Record<string, Record<string, string>> };
  streamedTurnIdsRef: { current: Record<string, boolean> };
  assistantItemCompletedByTurnRef: { current: Record<string, boolean> };
  debugLog: (...args: unknown[]) => void;
  applyMessageMutationForThread: (
    threadId: string,
    mutate: (prev: Array<Record<string, unknown>>) => Array<Record<string, unknown>>
  ) => void;
  resolveThreadIdFromTurn: (candidateThreadId: unknown, turnId?: string) => string;
};

export function handleTurnDeltaEvent(data: Record<string, unknown>, deps: TurnDeltaDeps) {
  const {
    itemPhaseByTurnRef,
    streamedTurnIdsRef,
    assistantItemCompletedByTurnRef,
    debugLog,
    applyMessageMutationForThread,
    resolveThreadIdFromTurn,
  } = deps;
  const method = typeof data.method === "string" ? data.method : "";
  const text = extractEventText(data);
  if (!text) {
    debugLog("[SSE] turn_delta ignored: empty text", data);
    return;
  }
  const variant = data.variant === "subagent" ? "subagent" : "";
  const turnId = typeof data.turn_id === "string" && data.turn_id ? data.turn_id : "";
  const itemId = extractEventItemId(data);
  const phase = turnId && itemId && itemPhaseByTurnRef.current[turnId] ? itemPhaseByTurnRef.current[turnId][itemId] || "" : "";
  const threadId = resolveThreadIdFromTurn(data.thread_id, turnId);
  if (!threadId && turnId) {
    debugLog("[SSE] turn_delta ignored: unresolved thread_id for turn", { turnId, data });
    return;
  }
  if (turnId) {
    streamedTurnIdsRef.current[turnId] = true;
  }
  if (method === "item/completed") {
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
          targetIndex = i;
        }
      }
      if (targetIndex >= 0) {
        const current = copy[targetIndex];
        copy[targetIndex] = {
          ...current,
          threadId: (current.threadId as string) || threadId,
          turnId: (current.turnId as string) || turnId,
          itemId: (current.itemId as string) || itemId,
          phase: (current.phase as string) || phase,
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
            turnId: (message?.turnId as string) || "",
            itemId: (message?.itemId as string) || "",
            variant: (message?.variant as string) || "",
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
    const shouldStartNewMessage = !!(turnId && assistantItemCompletedByTurnRef.current[turnId]);
    if (shouldStartNewMessage && turnId) {
      delete assistantItemCompletedByTurnRef.current[turnId];
    }
    if (
      !shouldStartNewMessage &&
      last &&
      last.role === "assistant" &&
      last.streaming &&
      ((last.variant as string) || "") === variant &&
      (((last.itemId as string) || "") === itemId || !itemId || (itemId && !((last.itemId as string) || ""))) &&
      (((last.turnId as string) || "") === turnId || !turnId)
    ) {
      last.text = `${String(last.text || "")}${text}`;
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
}
