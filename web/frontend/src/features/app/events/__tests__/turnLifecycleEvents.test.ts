import test from "node:test";
import assert from "node:assert/strict";

import { handleTurnCancelledEvent, handleTurnFailedEvent, handleTurnStartedEvent } from "../turnLifecycleEvents.js";

function createDeps() {
  const calls = [];
  const deps = {
    activeThreadRef: { current: "thread-1" },
    streamedTurnIdsRef: { current: { "turn-1": true } },
    assistantItemCompletedByTurnRef: { current: { "turn-1": true } },
    turnThreadIdRef: { current: {} },
    reasoningStateRef: { current: { item: {} } },
    updateThreadTabState: (...args) => calls.push(["updateThreadTabState", ...args]),
    setStatusForThread: (...args) => calls.push(["setStatusForThread", ...args]),
    setActivityDetailForThread: (...args) => calls.push(["setActivityDetailForThread", ...args]),
    setMessages: (updater) => calls.push(["setMessages", updater([{ streaming: true }])]),
    setCollaborationMode: (...args) => calls.push(["setCollaborationMode", ...args]),
    normalizeCollaborationMode: (raw) => (String(raw).toLowerCase() === "plan" ? "plan" : "build"),
    resolveThreadIdFromTurn: (threadId, turnId) => threadId || `resolved:${turnId}`,
    playTurnNotification: () => calls.push(["playTurnNotification"]),
    appendMessageToThread: (...args) => calls.push(["appendMessageToThread", ...args]),
    loadProjects: async () => {
      calls.push(["loadProjects"]);
    },
    loadSessionSummary: async () => {
      calls.push(["loadSessionSummary"]);
    },
  };
  return { deps, calls };
}

test("handleTurnStartedEvent marks thread running and stores turn mapping", () => {
  const { deps, calls } = createDeps();

  handleTurnStartedEvent(
    {
      thread_id: "thread-1",
      turn_id: "turn-1",
      params: { collaboration_mode_kind: "PLAN" },
    },
    deps
  );

  assert.equal(deps.turnThreadIdRef.current["turn-1"], "thread-1");
  assert.deepEqual(deps.reasoningStateRef.current, {});
  assert.deepEqual(calls.slice(0, 4), [
    ["updateThreadTabState", "thread-1", { status: "running", hasUnreadCompletion: false }],
    ["setStatusForThread", "thread-1", "running"],
    ["setActivityDetailForThread", "thread-1", ""],
    ["setCollaborationMode", "plan"],
  ]);
});

test("handleTurnFailedEvent clears refs, marks failed, and appends system message", () => {
  const { deps, calls } = createDeps();

  handleTurnFailedEvent({ thread_id: "thread-1", turn_id: "turn-1", text: "failed" }, deps);

  assert.equal(deps.streamedTurnIdsRef.current["turn-1"], undefined);
  assert.equal(deps.assistantItemCompletedByTurnRef.current["turn-1"], undefined);
  assert.deepEqual(deps.reasoningStateRef.current, {});
  assert.deepEqual(calls.slice(0, 4), [
    ["updateThreadTabState", "thread-1", { status: "failed", hasUnreadCompletion: false }],
    ["setStatusForThread", "thread-1", "idle"],
    ["setActivityDetailForThread", "thread-1", ""],
    ["appendMessageToThread", "thread-1", { role: "system", text: "failed", threadId: "thread-1", turnId: "turn-1", streaming: false }],
  ]);
});

test("handleTurnCancelledEvent clears refs and marks cancelled without appending text", () => {
  const { deps, calls } = createDeps();

  handleTurnCancelledEvent({ thread_id: "thread-1", turn_id: "turn-1" }, deps);

  assert.equal(deps.streamedTurnIdsRef.current["turn-1"], undefined);
  assert.equal(deps.assistantItemCompletedByTurnRef.current["turn-1"], undefined);
  assert.deepEqual(calls.slice(0, 3), [
    ["updateThreadTabState", "thread-1", { status: "cancelled", hasUnreadCompletion: false }],
    ["setStatusForThread", "thread-1", "idle"],
    ["setActivityDetailForThread", "thread-1", ""],
  ]);
});
