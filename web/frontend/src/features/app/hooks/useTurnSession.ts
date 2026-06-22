import { useEffect, useRef } from "react";

import { closeSseStream, createSseStream } from "../../../shared/events/sseStream";
import { handleTurnCompletedWorkspaceRefresh } from "../events/turnCompletion";
import { handleTurnDeltaEvent } from "../events/turnDeltaEvent";
import { handleTurnCancelledEvent, handleTurnFailedEvent, handleTurnStartedEvent } from "../events/turnLifecycleEvents";
import {
  handleAppEvent,
  handleContextCompactedItemEvent,
  handleFileChangeEvent,
  handleImageGenerationItemEvent,
  handleSystemMessageEvent,
  handleThreadsChangedEvent,
  handleWebSearchItemEvent,
} from "../events/sseMessageEvents";
import { logSseEvent, safeParseSseData } from "../events/sseEventUtils";
import type { TurnSessionArgs } from "./useTurnSession.types";

export default function useTurnSession(args: TurnSessionArgs) {
  const setStatusForThreadRef = useRef(args.setStatusForThread);
  setStatusForThreadRef.current = args.setStatusForThread;

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

  // Initial data load: runs once when the authenticated user is available.
  useEffect(() => {
    if (!me) return;
    loadProjects().catch(() => {});
    loadThreads({ projectKey: activeProjectKey, projectTabId: activeProjectTabId }).catch(() => {});
    loadSkillSuggestions().catch(() => {});
    loadSessionSummary().catch(() => {});
    loadApprovals().catch(() => {});
  }, [me]); // eslint-disable-line react-hooks/exhaustive-deps

  // SSE stream: manages the real-time event connection independently of the initial load.
  useEffect(() => {
    if (!me) {
      return;
    }

    const es = createSseStream();
    const parseEventData = (eventType: string, ev: MessageEvent<string>) => safeParseSseData(eventType, ev, debugError);
    const logEvent = (eventType: string, data: Record<string, unknown> | null) => logSseEvent(eventType, data, debugLog);

    es.onopen = () => {
      debugLog("[SSE] connected");
    };

    es.addEventListener("turn_delta", (ev) => {
      const data = parseEventData("turn_delta", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("turn_delta", data);
      handleTurnDeltaEvent(data, {
        itemPhaseByTurnRef,
        streamedTurnIdsRef,
        assistantItemCompletedByTurnRef,
        debugLog,
        applyMessageMutationForThread,
        resolveThreadIdFromTurn,
      });
    });

    es.addEventListener("plan_delta", (ev) => {
      const data = parseEventData("plan_delta", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("plan_delta", data);
      upsertPlanMessage("append", data);
    });

    es.addEventListener("plan_completed", (ev) => {
      const data = parseEventData("plan_completed", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("plan_completed", data);
      upsertPlanMessage("final", data);
      loadSessionSummary().catch(() => {});
    });

    es.addEventListener("plan_checklist", (ev) => {
      const data = parseEventData("plan_checklist", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("plan_checklist", data);
      upsertPlanChecklist(data);
    });

    es.addEventListener("reasoning_status", (ev) => {
      const data = parseEventData("reasoning_status", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("reasoning_status", data);
      appendReasoningStatus(data);
    });

    es.addEventListener("reasoning_completed", (ev) => {
      const data = parseEventData("reasoning_completed", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("reasoning_completed", data);
      completeReasoning(data);
    });

    es.addEventListener("web_search_item", (ev) => {
      const data = parseEventData("web_search_item", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("web_search_item", data);
      handleWebSearchItemEvent(data, { appendMessageToThread });
    });

    es.addEventListener("image_generation_item", (ev) => {
      const data = parseEventData("image_generation_item", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("image_generation_item", data);
      handleImageGenerationItemEvent(data, { appendMessageToThread });
    });

    es.addEventListener("context_compacted_item", (ev) => {
      const data = parseEventData("context_compacted_item", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("context_compacted_item", data);
      handleContextCompactedItemEvent(data, { appendMessageToThread });
    });

    es.addEventListener("turn_started", (ev) => {
      const data = parseEventData("turn_started", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("turn_started", data);
      handleTurnStartedEvent(data, {
        activeThreadRef,
        streamedTurnIdsRef,
        assistantItemCompletedByTurnRef,
        turnThreadIdRef,
        reasoningStateRef,
        updateThreadTabState,
        setStatusForThread,
        setActivityDetailForThread,
        setMessages,
        setCollaborationMode,
        normalizeCollaborationMode,
        resolveThreadIdFromTurn,
        playTurnNotification,
        appendMessageToThread,
        loadProjects,
        loadSessionSummary,
      });
    });

    es.addEventListener("turn_completed", (ev) => {
      const data = parseEventData("turn_completed", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("turn_completed", data);
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
      const data = parseEventData("turn_failed", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("turn_failed", data);
      handleTurnFailedEvent(data, {
        activeThreadRef,
        streamedTurnIdsRef,
        assistantItemCompletedByTurnRef,
        turnThreadIdRef,
        reasoningStateRef,
        updateThreadTabState,
        setStatusForThread,
        setActivityDetailForThread,
        setMessages,
        setCollaborationMode,
        normalizeCollaborationMode,
        resolveThreadIdFromTurn,
        playTurnNotification,
        appendMessageToThread,
        loadProjects,
        loadSessionSummary,
      });
    });

    es.addEventListener("turn_cancelled", (ev) => {
      const data = parseEventData("turn_cancelled", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("turn_cancelled", data);
      handleTurnCancelledEvent(data, {
        activeThreadRef,
        streamedTurnIdsRef,
        assistantItemCompletedByTurnRef,
        turnThreadIdRef,
        reasoningStateRef,
        updateThreadTabState,
        setStatusForThread,
        setActivityDetailForThread,
        setMessages,
        setCollaborationMode,
        normalizeCollaborationMode,
        resolveThreadIdFromTurn,
        playTurnNotification,
        appendMessageToThread,
        loadProjects,
        loadSessionSummary,
      });
    });

    es.addEventListener("approval_required", (ev) => {
      const data = parseEventData("approval_required", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("approval_required", data);
      if (typeof data.id !== "number") {
        return;
      }
      setApprovalBusyId(null);
      setApprovalItems([data]);
    });

    es.addEventListener("system_message", (ev) => {
      const data = parseEventData("system_message", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("system_message", data);
      handleSystemMessageEvent(data, { appendMessageToThread, loadSessionSummary, loadWorkspaceStatus });
    });

    es.addEventListener("file_change", (ev) => {
      const data = parseEventData("file_change", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("file_change", data);
      handleFileChangeEvent(data, { appendMessageToThread, loadSessionSummary, loadWorkspaceStatus });
    });

    es.addEventListener("subagents_changed", (ev) => {
      const data = parseEventData("subagents_changed", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("subagents_changed", data);
      loadSessionSummary().catch(() => {});
    });

    es.addEventListener("threads_changed", (ev) => {
      const data = parseEventData("threads_changed", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("threads_changed", data);
      handleThreadsChangedEvent(data, {
        loadSessionSummary,
        loadThreads,
        activeProjectKeyRef,
        activeProjectTabIdRef,
      }).catch(() => {});
    });

    es.addEventListener("app_event", (ev) => {
      const data = parseEventData("app_event", ev as MessageEvent<string>);
      if (!data) {
        return;
      }
      logEvent("app_event", data);
      handleAppEvent(data, {
        appendMessageToThread,
        applyMessageMutationForThread,
        loadSessionSummary,
        loadThreads,
        loadWorkspaceStatus,
        activeProjectKeyRef,
        activeProjectTabIdRef,
        streamedTurnIdsRef,
        resolveThreadIdFromTurn,
        itemPhaseByTurnRef,
      });
    });

    es.onerror = () => {
      debugError("[SSE] connection error");
      setStatusForThreadRef.current(activeThreadRef.current, "disconnected");
    };

    return () => closeSseStream(es);
  }, [me, turnNotificationEnabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
