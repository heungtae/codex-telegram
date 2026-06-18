import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProjectTabStatusById,
  normalizeCollaborationMode,
} from "../useAppDomainRuntime.js";

test("normalizeCollaborationMode accepts plan and defaults to build", () => {
  assert.equal(normalizeCollaborationMode(" PLAN "), "plan");
  assert.equal(normalizeCollaborationMode("default"), "build");
  assert.equal(normalizeCollaborationMode(null), "build");
});

test("buildProjectTabStatusById applies running, unread, failed, cancelled priority", () => {
  const statuses = buildProjectTabStatusById(
    [{ id: "running" }, { id: "unread" }, { id: "failed" }, { id: "cancelled" }, { id: "idle" }],
    {
      running: [{ status: "failed" }, { status: "running" }],
      unread: [{ status: "failed" }, { hasUnreadCompletion: true }],
      failed: [{ status: "failed" }],
      cancelled: [{ status: "cancelled" }],
    }
  );

  assert.deepEqual(statuses, {
    running: "running",
    unread: "unread",
    failed: "failed",
    cancelled: "cancelled",
    idle: "idle",
  });
});
