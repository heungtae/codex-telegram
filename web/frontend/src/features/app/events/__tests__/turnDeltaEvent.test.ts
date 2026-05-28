import test from "node:test";
import assert from "node:assert/strict";

import { handleTurnDeltaEvent } from "../turnDeltaEvent.js";

function createDeps(overrides: { prevMessages?: Array<Record<string, unknown>> } & Record<string, unknown> = {}) {
  const calls = [];
  const deps = {
    itemPhaseByTurnRef: { current: { "turn-1": { "item-1": "executing" } } },
    streamedTurnIdsRef: { current: {} },
    assistantItemCompletedByTurnRef: { current: {} },
    debugLog: (...args) => calls.push(["debugLog", ...args]),
    applyMessageMutationForThread: (threadId, mutate) => {
      const prev = overrides.prevMessages || [];
      calls.push(["applyMessageMutationForThread", threadId, mutate(prev)]);
    },
    resolveThreadIdFromTurn: (threadId, turnId) => threadId || (turnId ? `resolved:${turnId}` : ""),
    ...overrides,
  };
  return { deps, calls };
}

test("handleTurnDeltaEvent appends streaming assistant text", () => {
  const { deps, calls } = createDeps();

  handleTurnDeltaEvent(
    {
      method: "item/delta",
      text: "hello",
      thread_id: "thread-1",
      turn_id: "turn-1",
      item_id: "item-1",
    },
    deps
  );

  assert.equal(deps.streamedTurnIdsRef.current["turn-1"], true);
  assert.deepEqual(calls, [
    [
      "applyMessageMutationForThread",
      "thread-1",
      [
        {
          role: "assistant",
          text: "hello",
          variant: "",
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-1",
          phase: "executing",
          streaming: true,
        },
      ],
    ],
  ]);
});

test("handleTurnDeltaEvent marks matching completed assistant item as not streaming", () => {
  const { deps, calls } = createDeps({
    prevMessages: [
      {
        role: "assistant",
        text: "hello",
        variant: "",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "item-1",
        streaming: true,
      },
    ],
  });

  handleTurnDeltaEvent(
    {
      method: "item/completed",
      text: "hello",
      thread_id: "thread-1",
      turn_id: "turn-1",
      item_id: "item-1",
    },
    deps
  );

  assert.equal(deps.assistantItemCompletedByTurnRef.current["turn-1"], true);
  assert.equal(calls[0][2][0].streaming, false);
});
