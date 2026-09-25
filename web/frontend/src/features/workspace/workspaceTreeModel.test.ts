import test from "node:test";
import assert from "node:assert/strict";

import { collectCompactWorkspaceEntry, filterWorkspaceTree, getWorkspaceTreeChildren } from "./workspaceTreeModel.js";

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

test("cached empty directories do not reopen stale nested children", () => {
  const item = {
    path: "src",
    name: "src",
    type: "directory",
    children: [{ path: "src/old.txt", name: "old.txt", type: "file" }],
  };

  assert.deepEqual(getWorkspaceTreeChildren(item, { src: [] }), []);
  assert.deepEqual(getWorkspaceTreeChildren(item, {}), item.children);
});

test("expanded compact folder keeps its path after loading another single child", () => {
  const item = {
    path: "src",
    name: "src",
    type: "directory",
    children: [{ path: "src/main", name: "main", type: "directory" }],
  };
  const workspaceTree = {
    "": [item],
    "src/main": [{ path: "src/main/java", name: "java", type: "directory" }],
  };

  for (const isExpanded of [true, false]) {
    const compactEntry = collectCompactWorkspaceEntry({
      item,
      workspaceTree,
      workspaceDirectoryStatus: {},
      workspaceStatusItems: {},
      expandedWorkspaceDirs: { "src/main": isExpanded },
    });

    assert.equal(compactEntry.leafPath, "src/main");
    assert.equal(compactEntry.label, "src/main");
    assert.equal(compactEntry.isExpanded, isExpanded);
  }
});
