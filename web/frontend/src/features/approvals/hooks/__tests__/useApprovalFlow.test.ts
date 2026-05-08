import test from "node:test";
import assert from "node:assert/strict";

import { canSubmitApproval, normalizeApprovalItems } from "../useApprovalFlow.js";

test("normalizeApprovalItems keeps only the latest numeric id item", () => {
  const items = [
    { id: "x" },
    { id: 1, title: "first" },
    { id: null },
    { id: 3, title: "latest" },
  ];
  const result = normalizeApprovalItems(items);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 3);
});

test("normalizeApprovalItems tolerates invalid input", () => {
  assert.deepEqual(normalizeApprovalItems(null), []);
  assert.deepEqual(normalizeApprovalItems([]), []);
});

test("canSubmitApproval validates request state", () => {
  assert.equal(canSubmitApproval(10, "approve", null), true);
  assert.equal(canSubmitApproval("10", "approve", null), false);
  assert.equal(canSubmitApproval(10, "", null), false);
  assert.equal(canSubmitApproval(10, "approve", 10), false);
});
