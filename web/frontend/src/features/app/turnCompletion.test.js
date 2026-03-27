import test from "node:test";
import assert from "node:assert/strict";

import { handleTurnCompletedWorkspaceRefresh } from "./turnCompletion.js";

test("turn completion handler refreshes workspace browser and clears streamed turn state", async () => {
  const calls = [];
  const refs = {
    streamedTurnIdsRef: { current: { "turn-1": true } },
    assistantItemCompletedByTurnRef: { current: { "turn-1": true } },
    turnThreadIdRef: { current: { "turn-1": "thread-1" } },
  };
  const deps = {
    data: { thread_id: "thread-1", turn_id: "turn-1" },
    activeThreadId: "thread-1",
    activeProjectKey: "default",
    activeProjectTabId: "project:default",
    refreshWorkspaceBrowser: async () => {
      calls.push("refreshWorkspaceBrowser");
    },
    loadThreads: async (payload) => {
      calls.push(["loadThreads", payload]);
    },
    loadProjects: async () => {
      calls.push("loadProjects");
    },
    loadSessionSummary: async () => {
      calls.push("loadSessionSummary");
    },
    updateThreadTabState: (threadId, patch) => {
      calls.push(["updateThreadTabState", threadId, patch]);
    },
    playTurnNotification: () => {
      calls.push("playTurnNotification");
    },
    setStatusForThread: (threadId, status) => {
      calls.push(["setStatusForThread", threadId, status]);
    },
    setActivityDetailForThread: (threadId, detail) => {
      calls.push(["setActivityDetailForThread", threadId, detail]);
    },
    setMessages: (updater) => {
      const result = updater([{ role: "assistant", streaming: true }]);
      calls.push(["setMessages", result]);
    },
    ...refs,
    resolveThreadIdFromTurn: (threadId, turnId) => threadId || `resolved:${turnId}`,
  };

  await handleTurnCompletedWorkspaceRefresh(deps);

  assert.equal(refs.turnThreadIdRef.current["turn-1"], undefined);
  assert.equal(refs.streamedTurnIdsRef.current["turn-1"], undefined);
  assert.equal(refs.assistantItemCompletedByTurnRef.current["turn-1"], undefined);
  assert.deepEqual(calls, [
    ["updateThreadTabState", "thread-1", { status: "completed", hasUnreadCompletion: false }],
    ["setStatusForThread", "thread-1", "idle"],
    ["setActivityDetailForThread", "thread-1", ""],
    ["setMessages", [{ role: "assistant", streaming: false }]],
    ["loadThreads", { projectKey: "default", projectTabId: "project:default" }],
    "loadProjects",
    "loadSessionSummary",
    "refreshWorkspaceBrowser",
  ]);
});
