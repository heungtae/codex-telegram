import test from "node:test";
import assert from "node:assert/strict";

import { resolveThreadFallback } from "../useThreadsDomain.js";

test("resolveThreadFallback picks same index first", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const next = resolveThreadFallback(rows, 1);
  assert.equal(next.id, "b");
});

test("resolveThreadFallback falls back to previous or first", () => {
  const rows = [{ id: "a" }, { id: "b" }];
  const prev = resolveThreadFallback(rows, 5);
  assert.equal(prev.id, "a");
  const first = resolveThreadFallback(rows, 0);
  assert.equal(first.id, "a");
});

test("resolveThreadFallback returns null for empty rows", () => {
  assert.equal(resolveThreadFallback([], 0), null);
});
