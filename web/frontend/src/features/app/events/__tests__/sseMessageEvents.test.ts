import test from "node:test";
import assert from "node:assert/strict";

import { handleAppEvent, handleFileChangeEvent, handleSystemMessageEvent, handleWebSearchItemEvent } from "../sseMessageEvents.js";

function createDeps(overrides: { prevMessages?: Array<Record<string, unknown>> } & Record<string, unknown> = {}) {
  const calls = [];
  const deps = {
    appendMessageToThread: (...args) => calls.push(["appendMessageToThread", ...args]),
    applyMessageMutationForThread: (threadId, mutate) => {
      calls.push(["applyMessageMutationForThread", threadId, mutate(overrides.prevMessages || [])]);
    },
    loadSessionSummary: async () => {
      calls.push(["loadSessionSummary"]);
    },
    loadWorkspaceStatus: async () => {
      calls.push(["loadWorkspaceStatus"]);
    },
    streamedTurnIdsRef: { current: {} },
    resolveThreadIdFromTurn: (threadId, turnId) => threadId || `resolved:${turnId}`,
    itemPhaseByTurnRef: { current: {} },
    ...overrides,
  };
  return { deps, calls };
}

test("handleSystemMessageEvent appends system text and refreshes summaries", () => {
  const { deps, calls } = createDeps();

  handleSystemMessageEvent({ thread_id: "thread-1", turn_id: "turn-1", text: "done" }, deps);

  assert.deepEqual(calls.slice(0, 3), [
    ["appendMessageToThread", "thread-1", { role: "system", text: "done", threadId: "thread-1", turnId: "turn-1", streaming: false }],
    ["loadSessionSummary"],
    ["loadWorkspaceStatus"],
  ]);
});

test("handleFileChangeEvent appends file change message with files and diff", () => {
  const { deps, calls } = createDeps();

  handleFileChangeEvent({ thread_id: "thread-1", turn_id: "turn-1", summary: "changed", files: [{ path: "a.ts" }], diff: "diff" }, deps);

  assert.deepEqual(calls[0], [
    "appendMessageToThread",
    "thread-1",
    {
      role: "system",
      text: "changed",
      files: [{ path: "a.ts" }],
      diff: "diff",
      threadId: "thread-1",
      turnId: "turn-1",
      kind: "file_change",
      streaming: false,
    },
  ]);
});

test("handleWebSearchItemEvent appends web search system message", () => {
  const { deps, calls } = createDeps();

  handleWebSearchItemEvent({ thread_id: "thread-1", turn_id: "turn-1", item_id: "item-1", query: "codex", action: "search" }, deps);

  assert.equal(calls[0][2].kind, "web_search");
  assert.equal(calls[0][2].text, "codex");
});

test("handleAppEvent appends assistant fallback for completed message when not already streamed", () => {
  const { deps, calls } = createDeps();

  handleAppEvent(
    {
      method: "item/completed",
      thread_id: "thread-1",
      turn_id: "turn-1",
      params: { item: { id: "item-1", type: "assistantMessage", text: "final" } },
    },
    deps
  );

  assert.deepEqual(calls[0], [
    "applyMessageMutationForThread",
    "thread-1",
    [{ role: "assistant", text: "final", threadId: "thread-1", turnId: "turn-1", streaming: true }],
  ]);
});
