import test from "node:test";
import assert from "node:assert/strict";

import { filterWorkspaceTree } from "./workspaceTreeModel.js";

test("filterWorkspaceTree keeps matching files and ancestor directories", () => {
  const tree = {
    "": [
      { path: "src", name: "src", type: "directory" },
      { path: "README.md", name: "README.md", type: "file" },
    ],
    src: [
      { path: "src/App.tsx", name: "App.tsx", type: "file" },
      { path: "src/theme.css", name: "theme.css", type: "file" },
    ],
  };

  const filtered = filterWorkspaceTree(tree, "app");

  assert.deepEqual(filtered[""], [{ path: "src", name: "src", type: "directory" }]);
  assert.deepEqual(filtered.src, [{ path: "src/App.tsx", name: "App.tsx", type: "file" }]);
});

test("filterWorkspaceTree returns the original tree for empty queries", () => {
  const tree = { "": [{ path: "README.md", name: "README.md", type: "file" }] };

  assert.equal(filterWorkspaceTree(tree, ""), tree);
});
