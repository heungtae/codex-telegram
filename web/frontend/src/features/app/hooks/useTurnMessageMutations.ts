export default function useTurnMessageMutations({
  applyMessageMutationForThread,
  normalizeThreadId,
  formatPlanChecklistText,
  summarizeReasoningStatus,
  reasoningStateRef,
  setActivityDetailForThread,
}) {
  function upsertPlanMessage(mode, payload) {
    const itemId = typeof payload?.item_id === "string" ? payload.item_id : "";
    const text = typeof payload?.text === "string" ? payload.text : "";
    if (!itemId || !text) {
      return;
    }
    const targetThreadId = normalizeThreadId(payload?.thread_id);
    applyMessageMutationForThread(targetThreadId, (prev) => {
      const next = [...prev];
      const existingIndex = next.findIndex((message) => message.kind === "plan" && message.itemId === itemId);
      const streaming = mode !== "final";
      if (existingIndex >= 0) {
        const existing = next[existingIndex];
        next[existingIndex] = {
          ...existing,
          role: "assistant",
          kind: "plan",
          itemId,
          threadId: normalizeThreadId(payload?.thread_id),
          turnId: typeof payload?.turn_id === "string" ? payload.turn_id : existing?.turnId || "",
          text: mode === "append" ? `${existing.text || ""}${text}` : text,
          streaming,
        };
        return next;
      }
      next.push({
        role: "assistant",
        kind: "plan",
        itemId,
        threadId: normalizeThreadId(payload?.thread_id),
        turnId: typeof payload?.turn_id === "string" ? payload.turn_id : "",
        text,
        streaming,
      });
      return next;
    });
  }

  function upsertPlanChecklist(payload) {
    const text = formatPlanChecklistText(payload?.explanation, payload?.plan);
    const turnId = typeof payload?.turn_id === "string" ? payload.turn_id : "";
    if (!text || !turnId) {
      return;
    }
    const targetThreadId = normalizeThreadId(payload?.thread_id);
    applyMessageMutationForThread(targetThreadId, (prev) => {
      const next = [...prev];
      const existingIndex = next.findIndex(
        (message) => message.kind === "plan_checklist" && message.turnId === turnId
      );
      const value = {
        role: "system",
        kind: "plan_checklist",
        threadId: normalizeThreadId(payload?.thread_id),
        turnId,
        text,
        plan: Array.isArray(payload?.plan) ? payload.plan : [],
        explanation: typeof payload?.explanation === "string" ? payload.explanation : "",
        streaming: false,
      };
      if (existingIndex >= 0) {
        next[existingIndex] = { ...next[existingIndex], ...value };
        return next;
      }
      next.push(value);
      return next;
    });
  }

  function appendReasoningStatus(payload) {
    const itemId = typeof payload?.item_id === "string" ? payload.item_id : "";
    if (!itemId) {
      return;
    }
    const existing = reasoningStateRef.current[itemId] || {
      itemId,
      turnId: typeof payload?.turn_id === "string" ? payload.turn_id : "",
      threadId: normalizeThreadId(payload?.thread_id),
      summary: "",
      raw: "",
    };
    if (payload?.section_break && existing.summary && !existing.summary.endsWith("\n\n")) {
      existing.summary += "\n\n";
    }
    if (payload?.raw) {
      if (typeof payload?.delta === "string" && payload.delta) {
        existing.raw += payload.delta;
      }
    } else if (typeof payload?.delta === "string" && payload.delta) {
      existing.summary += payload.delta;
    }
    if (!existing.turnId && typeof payload?.turn_id === "string") {
      existing.turnId = payload.turn_id;
    }
    if (!existing.threadId) {
      existing.threadId = normalizeThreadId(payload?.thread_id);
    }
    reasoningStateRef.current[itemId] = existing;
    const detail = summarizeReasoningStatus(existing.summary) || "Reasoning";
    const targetThreadId = normalizeThreadId(payload?.thread_id) || existing.threadId || "";
    setActivityDetailForThread(targetThreadId, detail);
  }

  function completeReasoning(payload) {
    const itemId = typeof payload?.item_id === "string" ? payload.item_id : "";
    const existing = (itemId && reasoningStateRef.current[itemId]) || null;
    const summaryText = Array.isArray(payload?.summary_text)
      ? payload.summary_text.filter((entry) => typeof entry === "string" && entry.trim())
      : [];
    const rawContent = Array.isArray(payload?.raw_content)
      ? payload.raw_content.filter((entry) => typeof entry === "string" && entry.trim())
      : [];
    const summary = (summaryText.length ? summaryText.join("\n\n") : existing?.summary || "").trim();
    const raw = (rawContent.length ? rawContent.join("\n\n") : existing?.raw || "").trim();
    if (itemId) {
      delete reasoningStateRef.current[itemId];
    }
    const targetThreadId = normalizeThreadId(payload?.thread_id) || existing?.threadId || "";
    setActivityDetailForThread(targetThreadId, "");
    if (!summary) {
      return;
    }
    applyMessageMutationForThread(targetThreadId, (prev) => [
      ...prev,
      {
        role: "system",
        kind: "reasoning",
        threadId: targetThreadId,
        turnId: typeof payload?.turn_id === "string" ? payload.turn_id : existing?.turnId || "",
        itemId,
        text: summary,
        rawReasoning: raw,
        streaming: false,
      },
    ]);
  }

  return { upsertPlanMessage, upsertPlanChecklist, appendReasoningStatus, completeReasoning };
}
