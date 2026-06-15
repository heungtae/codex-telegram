import test from "node:test";
import assert from "node:assert/strict";

import { createOpenExplorerPayload } from "../projectExplorer.js";

test("open explorer payload sends only the project key", () => {
  assert.deepEqual(createOpenExplorerPayload("work"), {
    project_key: "work",
  });
});
