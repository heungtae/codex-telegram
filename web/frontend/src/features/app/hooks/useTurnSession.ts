import { useEffect } from "react";

import { normalizeThreadId } from "../../common/utils";
import { closeSseStream, createSseStream } from "../../../shared/events/sseStream";
import { formatWebSearchAction } from "../../common/utils";
import { handleTurnCompletedWorkspaceRefresh } from "../events/turnCompletion";
import type { TurnSessionArgs } from "./useTurnSession.types";

export default function useTurnSession(args: TurnSessionArgs) {
  const {
    me,
    turnNotificationEnabled,
    loadProjects,
    loadThreads,
    loadSkillSuggestions,
    loadSessionSummary,
    loadApprovals,
    loadWorkspaceStatus,
    refreshWorkspaceBrowser,
    activeProjectKey,
    activeProjectTabId,
    activeThreadRef,
    activeProjectKeyRef,
    activeProjectTabIdRef,
    streamedTurnIdsRef,
    assistantItemCompletedByTurnRef,
    itemPhaseByTurnRef,
    turnThreadIdRef,
    reasoningStateRef,
    debugLog,
    debugError,
    appendMessageToThread,
    applyMessageMutationForThread,
    appendReasoningStatus,
    completeReasoning,
    upsertPlanMessage,
    upsertPlanChecklist,
    setStatusForThread,
    setActivityDetailForThread,
    setMessages,
    updateThreadTabState,
    playTurnNotification,
    setApprovalBusyId,
    setApprovalItems,
    setCollaborationMode,
    normalizeCollaborationMode,
    resolveThreadIdFromTurn,
  } = args;

  useEffect(() => {
    if (!me) {
      return;
    }
    loadProjects().catch(() => {});
    loadThreads({ projectKey: activeProjectKey, projectTabId: activeProjectTabId }).catch(() => {});
    loadSkillSuggestions().catch(() => {});
    loadSessionSummary().catch(() => {});
    loadApprovals().catch(() => {});

    const es = createSseStream();
    const safeParseSseData = (eventType: string, ev: MessageEvent<string>) => {
      try {
        return JSON.parse(ev.data) as Record<string, unknown>;
      } catch (err) {
        debugError("[SSE parse error]", eventType, ev?.data, err);
        return null;
      }
    };
    const logSseEvent = (eventType: string, data: Record<string, unknown> | null) => {
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
    };
    const recordItemPhase = (data: Record<string, unknown>) => {
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
    };
    const extractEventText = (data: Record<string, unknown>) => {
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
    };
    const extractEventItemId = (data: Record<string, unknown>) => {
      if (typeof data.item_id === "string" && data.item_id) {
        return data.item_id;
      }
      const params = data.params as Record<string, unknown> | undefined;
      const item = params?.item as Record<string, unknown> | undefined;
      if (item && typeof item.id === "string" && item.id) {
        return item.id;
      }
      return "";
    };

    es.onopen = () => {
      debugLog("[SSE] connected");
    };

    es.addEventListener("turn_delta", (ev) => {
      const data = safeParseSseData("turn_delta", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logSseEvent("turn_delta", data);
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
    });

    es.addEventListener("plan_delta", (ev) => {
      const data = safeParseSseData("plan_delta", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logSseEvent("plan_delta", data);
      upsertPlanMessage("append", data);
    });

    es.addEventListener("plan_completed", (ev) => {
      const data = safeParseSseData("plan_completed", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logSseEvent("plan_completed", data);
      upsertPlanMessage("final", data);
      loadSessionSummary().catch(() => {});
    });

    es.addEventListener("plan_checklist", (ev) => {
      const data = safeParseSseData("plan_checklist", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logSseEvent("plan_checklist", data);
      upsertPlanChecklist(data);
    });

    es.addEventListener("reasoning_status", (ev) => {
      const data = safeParseSseData("reasoning_status", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logSseEvent("reasoning_status", data);
      appendReasoningStatus(data);
    });

    es.addEventListener("reasoning_completed", (ev) => {
      const data = safeParseSseData("reasoning_completed", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logSseEvent("reasoning_completed", data);
      completeReasoning(data);
    });

    es.addEventListener("web_search_item", (ev) => {
      const data = safeParseSseData("web_search_item", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logSseEvent("web_search_item", data);
      const query = typeof data.query === "string" ? data.query.trim() : "";
      const actionText = formatWebSearchAction(data.action);
      if (!query && !actionText) {
        return;
      }
      appendMessageToThread(normalizeThreadId(data.thread_id), {
        role: "system",
        kind: "web_search",
        threadId: normalizeThreadId(data.thread_id),
        turnId: typeof data.turn_id === "string" ? data.turn_id : "",
        itemId: typeof data.item_id === "string" ? data.item_id : "",
        text: query || "Web search",
        detail: actionText,
        streaming: false,
      });
    });

    es.addEventListener("image_generation_item", (ev) => {
      const data = safeParseSseData("image_generation_item", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logSseEvent("image_generation_item", data);
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
      appendMessageToThread(normalizeThreadId(data.thread_id), {
        role: "system",
        kind: "image_generation",
        threadId: normalizeThreadId(data.thread_id),
        turnId: typeof data.turn_id === "string" ? data.turn_id : "",
        itemId: typeof data.item_id === "string" ? data.item_id : "",
        text: revisedPrompt || "Generated image",
        detail: detailLines.join("\n"),
        streaming: false,
      });
    });

    es.addEventListener("context_compacted_item", (ev) => {
      const data = safeParseSseData("context_compacted_item", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logSseEvent("context_compacted_item", data);
      const text = typeof data.text === "string" && data.text.trim() ? data.text.trim() : "Context compacted";
      appendMessageToThread(normalizeThreadId(data.thread_id), {
        role: "system",
        text,
        threadId: normalizeThreadId(data.thread_id),
        turnId: typeof data.turn_id === "string" ? data.turn_id : "",
        streaming: false,
      });
    });

    es.addEventListener("turn_started", (ev) => {
      const data = safeParseSseData("turn_started", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logSseEvent("turn_started", data);
      const turnId = typeof data.turn_id === "string" ? data.turn_id : "";
      const eventThreadId = resolveThreadIdFromTurn(data.thread_id, turnId);
      if (turnId && eventThreadId) {
        turnThreadIdRef.current[turnId] = eventThreadId;
      }
      updateThreadTabState(eventThreadId, { status: "running", hasUnreadCompletion: false });
      setStatusForThread(eventThreadId, "running");
      setActivityDetailForThread(eventThreadId, "");
      const params = data.params as Record<string, unknown> | undefined;
      const actualMode = params?.collaboration_mode_kind || params?.collaborationModeKind;
      if (typeof actualMode === "string") {
        setCollaborationMode(normalizeCollaborationMode(actualMode));
      }
      reasoningStateRef.current = {};
      if (eventThreadId === activeThreadRef.current) {
        setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
      }
    });

    es.addEventListener("turn_completed", (ev) => {
      const data = safeParseSseData("turn_completed", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logSseEvent("turn_completed", data);
      reasoningStateRef.current = {};
      handleTurnCompletedWorkspaceRefresh({
        data,
        activeThreadId: activeThreadRef.current,
        activeProjectKey: activeProjectKeyRef.current,
        activeProjectTabId: activeProjectTabIdRef.current,
        refreshWorkspaceBrowser,
        loadThreads,
        loadProjects,
        loadSessionSummary,
        updateThreadTabState,
        playTurnNotification,
        setStatusForThread,
        setActivityDetailForThread,
        setMessages,
        streamedTurnIdsRef,
        assistantItemCompletedByTurnRef,
        turnThreadIdRef,
        resolveThreadIdFromTurn,
      });
    });

    es.addEventListener("turn_failed", (ev) => {
      const data = safeParseSseData("turn_failed", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logSseEvent("turn_failed", data);
      const turnId = typeof data.turn_id === "string" ? data.turn_id : "";
      if (turnId) {
        delete streamedTurnIdsRef.current[turnId];
        delete assistantItemCompletedByTurnRef.current[turnId];
      }
      const failedThreadId = resolveThreadIdFromTurn(data.thread_id, turnId);
      if (turnId) {
        delete turnThreadIdRef.current[turnId];
      }
      const shouldNotify = failedThreadId && failedThreadId !== activeThreadRef.current;
      updateThreadTabState(failedThreadId, {
        status: "failed",
        hasUnreadCompletion: failedThreadId ? shouldNotify : true,
      });
      if (shouldNotify) {
        playTurnNotification();
      }
      const text = typeof data.text === "string" ? data.text : "Turn failed.";
      const threadId = resolveThreadIdFromTurn(data.thread_id, turnId);
      setStatusForThread(threadId, "idle");
      setActivityDetailForThread(threadId, "");
      reasoningStateRef.current = {};
      appendMessageToThread(threadId, { role: "system", text, threadId, turnId, streaming: false });
      loadProjects().catch(() => {});
      loadSessionSummary().catch(() => {});
    });

    es.addEventListener("turn_cancelled", (ev) => {
      const data = safeParseSseData("turn_cancelled", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logSseEvent("turn_cancelled", data);
      const turnId = typeof data.turn_id === "string" ? data.turn_id : "";
      if (turnId) {
        delete streamedTurnIdsRef.current[turnId];
        delete assistantItemCompletedByTurnRef.current[turnId];
      }
      const cancelledThreadId = resolveThreadIdFromTurn(data.thread_id, turnId);
      if (turnId) {
        delete turnThreadIdRef.current[turnId];
      }
      const shouldNotify = cancelledThreadId && cancelledThreadId !== activeThreadRef.current;
      updateThreadTabState(cancelledThreadId, {
        status: "cancelled",
        hasUnreadCompletion: cancelledThreadId ? shouldNotify : true,
      });
      if (shouldNotify) {
        playTurnNotification();
      }
      setStatusForThread(cancelledThreadId, "idle");
      setActivityDetailForThread(cancelledThreadId, "");
      reasoningStateRef.current = {};
      loadProjects().catch(() => {});
      loadSessionSummary().catch(() => {});
    });

    es.addEventListener("approval_required", (ev) => {
      const data = safeParseSseData("approval_required", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logSseEvent("approval_required", data);
      if (typeof data.id !== "number") {
        return;
      }
      setApprovalBusyId(null);
      setApprovalItems([data]);
    });

    es.addEventListener("system_message", (ev) => {
      const data = safeParseSseData("system_message", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logSseEvent("system_message", data);
      const text = typeof data.text === "string" ? data.text : "";
      if (!text) {
        return;
      }
      appendMessageToThread(normalizeThreadId(data.thread_id), {
        role: "system",
        text,
        threadId: normalizeThreadId(data.thread_id),
        turnId: typeof data.turn_id === "string" ? data.turn_id : "",
        streaming: false,
      });
      loadSessionSummary().catch(() => {});
      loadWorkspaceStatus().catch(() => {});
    });

    es.addEventListener("file_change", (ev) => {
      const data = safeParseSseData("file_change", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logSseEvent("file_change", data);
      const summary = typeof data.summary === "string" ? data.summary : (typeof data.text === "string" ? data.text : "");
      const files = Array.isArray(data.files) ? data.files : [];
      const diff = typeof data.diff === "string" ? data.diff : "";
      const threadId = normalizeThreadId(data.thread_id);
      const turnId = typeof data.turn_id === "string" ? data.turn_id : "";
      if (!summary && files.length === 0 && !diff) {
        return;
      }
      appendMessageToThread(threadId, {
        role: "system",
        text: summary || "Applied patch changes",
        files,
        diff,
        threadId,
        turnId,
        kind: "file_change",
        streaming: false,
      });
      loadWorkspaceStatus().catch(() => {});
      loadSessionSummary().catch(() => {});
    });

    es.addEventListener("subagents_changed", (ev) => {
      const data = safeParseSseData("subagents_changed", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logSseEvent("subagents_changed", data);
      loadSessionSummary().catch(() => {});
    });

    es.addEventListener("app_event", (ev) => {
      const data = safeParseSseData("app_event", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logSseEvent("app_event", data);
      const method = typeof data.method === "string" ? data.method : "";
      if (["thread/started", "thread/status/changed", "thread/closed", "subagents_changed"].includes(method)) {
        loadSessionSummary().catch(() => {});
      }
      if (data.method === "item/started" || data.method === "item/completed") {
        recordItemPhase(data);
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
      const threadId = resolveThreadIdFromTurn(data.thread_id, turnId);
      if (!threadId && turnId) {
        return;
      }
      if (turnId && streamedTurnIdsRef.current[turnId]) {
        return;
      }
      applyMessageMutationForThread(threadId, (prev) => {
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
    });

    es.onerror = () => {
      debugError("[SSE] connection error");
      setStatusForThread(activeThreadRef.current, "disconnected");
    };

    return () => closeSseStream(es);
  }, [me, turnNotificationEnabled]);
}
