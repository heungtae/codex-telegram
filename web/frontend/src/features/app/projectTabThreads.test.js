import test from "node:test";
import assert from "node:assert/strict";

import { resolveProjectTabThreadId } from "./projectTabThreads.js";

test("resolveProjectTabThreadId prefers the selected thread within the active project tab", () => {
  const threadId = resolveProjectTabThreadId({
    projectTabId: "project:b",
    activeThreadId: "thread-a",
    threadProjectTabIdByThreadId: {
      "thread-a": "project:a",
    },
    activeThreadTabIdByProjectTabId: {
      "project:b": "thread-b",
    },
    threadTabsByProjectTabId: {
      "project:b": [{ id: "thread-b" }],
    },
  });

  assert.equal(threadId, "thread-b");
});

test("resolveProjectTabThreadId does not reuse a thread owned by a different project tab", () => {
  const threadId = resolveProjectTabThreadId({
    projectTabId: "project:b",
    activeThreadId: "thread-a",
    threadProjectTabIdByThreadId: {
      "thread-a": "project:a",
    },
    activeThreadTabIdByProjectTabId: {
      "project:b": "",
    },
    threadTabsByProjectTabId: {
      "project:b": [],
    },
  });

  assert.equal(threadId, "");
});

test("resolveProjectTabThreadId falls back to the active thread only when it is unowned or belongs to the same project tab", () => {
  const threadId = resolveProjectTabThreadId({
    projectTabId: "project:b",
    activeThreadId: "thread-b",
    threadProjectTabIdByThreadId: {
      "thread-b": "project:b",
    },
    activeThreadTabIdByProjectTabId: {
      "project:b": "",
    },
    threadTabsByProjectTabId: {
      "project:b": [],
    },
  });

  assert.equal(threadId, "thread-b");
});
