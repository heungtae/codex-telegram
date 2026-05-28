import test from "node:test";
import assert from "node:assert/strict";

import { extractEventItemId, extractEventText, recordItemPhase } from "../sseEventUtils.js";

test("extractEventText reads direct text, item text, and content text", () => {
  assert.equal(extractEventText({ text: "direct" }), "direct");
  assert.equal(extractEventText({ params: { item: { text: "item text" } } }), "item text");
  assert.equal(extractEventText({ params: { item: { content: [{ text: "content text" }] } } }), "content text");
  assert.equal(extractEventText({ params: { item: { content: [{ text: "" }] } } }), "");
});

test("extractEventItemId prefers payload item_id and falls back to params item id", () => {
  assert.equal(extractEventItemId({ item_id: "payload-item", params: { item: { id: "params-item" } } }), "payload-item");
  assert.equal(extractEventItemId({ params: { item: { id: "params-item" } } }), "params-item");
  assert.equal(extractEventItemId({ params: { item: {} } }), "");
});

test("recordItemPhase stores lower-case item phase per turn", () => {
  const itemPhaseByTurnRef = { current: {} };

  recordItemPhase(
    {
      turn_id: "turn-1",
      params: { item: { id: "item-1", phase: "RUNNING" } },
    },
    itemPhaseByTurnRef
  );

  assert.deepEqual(itemPhaseByTurnRef.current, { "turn-1": { "item-1": "running" } });
});
