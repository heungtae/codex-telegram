export function safeParseSseData(
  eventType: string,
  ev: MessageEvent<string>,
  debugError: (...args: unknown[]) => void
) {
  try {
    return JSON.parse(ev.data) as Record<string, unknown>;
  } catch (err) {
    debugError("[SSE parse error]", eventType, ev?.data, err);
    return null;
  }
}

export function logSseEvent(
  eventType: string,
  data: Record<string, unknown> | null,
  debugLog: (...args: unknown[]) => void
) {
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
}

export function recordItemPhase(
  data: Record<string, unknown>,
  itemPhaseByTurnRef: { current: Record<string, Record<string, string>> }
) {
  const turnId = typeof data.turn_id === "string" && data.turn_id ? data.turn_id : "";
  if (!turnId) {
    return;
  }
  const params = data.params as Record<string, unknown> | undefined;
  const item = params?.item as Record<string, unknown> | undefined;
  if (!item) {
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
}

export function extractEventText(data: Record<string, unknown>) {
  if (typeof data.text === "string" && data.text.trim()) {
    return data.text;
  }
  const params = data.params as Record<string, unknown> | undefined;
  const item = params?.item as Record<string, unknown> | undefined;
  if (!item) {
    return "";
  }
  if (typeof item.text === "string" && item.text.trim()) {
    return item.text;
  }
  const content = item.content;
  if (Array.isArray(content)) {
    for (const entry of content) {
      const row = entry as Record<string, unknown>;
      if (row && typeof row.text === "string" && row.text.trim()) {
        return row.text;
      }
    }
  }
  return "";
}

export function extractEventItemId(data: Record<string, unknown>) {
  if (typeof data.item_id === "string" && data.item_id) {
    return data.item_id;
  }
  const params = data.params as Record<string, unknown> | undefined;
  const item = params?.item as Record<string, unknown> | undefined;
  if (item && typeof item.id === "string" && item.id) {
    return item.id;
  }
  return "";
}
