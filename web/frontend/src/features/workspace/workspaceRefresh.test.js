import test from "node:test";
import assert from "node:assert/strict";

import { collectWorkspaceRefreshPaths } from "./workspaceRefresh.js";

test("collectWorkspaceRefreshPaths keeps root and cached subtree paths", () => {
  const paths = collectWorkspaceRefreshPaths({
    "": [{ name: "src", path: "src", type: "directory" }],
    src: [{ name: "nested", path: "src/nested", type: "directory" }],
    "src/nested": [{ name: "file.txt", path: "src/nested/file.txt", type: "file" }],
  });

  assert.deepEqual(paths, ["", "src", "src/nested"]);
});

test("collectWorkspaceRefreshPaths removes duplicate paths and tolerates empty input", () => {
  assert.deepEqual(collectWorkspaceRefreshPaths(null), [""]);
  assert.deepEqual(collectWorkspaceRefreshPaths({ "": [], src: [], src: [] }), ["", "src"]);
});
