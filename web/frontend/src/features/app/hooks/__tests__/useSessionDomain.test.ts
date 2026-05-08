import test from "node:test";
import assert from "node:assert/strict";

import { normalizeSessionMode } from "../useSessionDomain.js";

test("normalizeSessionMode returns plan for plan", () => {
  assert.equal(normalizeSessionMode("plan"), "plan");
  assert.equal(normalizeSessionMode(" PLAN "), "plan");
});

test("normalizeSessionMode defaults to build", () => {
  assert.equal(normalizeSessionMode("build"), "build");
  assert.equal(normalizeSessionMode("unknown"), "build");
  assert.equal(normalizeSessionMode(null), "build");
});
