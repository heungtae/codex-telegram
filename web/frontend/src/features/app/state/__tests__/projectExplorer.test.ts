import test from "node:test";
import assert from "node:assert/strict";

import { createOpenExplorerPayload, openProjectInExplorer } from "../projectExplorer.js";

test("open explorer payload sends only the project key", () => {
  assert.deepEqual(createOpenExplorerPayload("work"), {
    project_key: "work",
  });
});

test("openProjectInExplorer posts the current project key", async () => {
  const calls = [];
  const fetchImpl = async (...args) => {
    calls.push(args);
    return { ok: true };
  };

  await openProjectInExplorer("work", fetchImpl);

  assert.deepEqual(calls, [
    [
      "/api/projects/open-explorer",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_key: "work" }),
      },
    ],
  ]);
});
