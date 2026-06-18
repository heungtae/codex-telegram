import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import WorkspaceTree from "../WorkspaceTree.js";

test("WorkspaceTree renders compact directories, children, selection, and status", () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkspaceTree, {
      workspaceTree: {
        "": [{ path: "src", name: "src", type: "directory", has_children: true }],
        src: [{ path: "src/features", name: "features", type: "directory", has_children: true }],
        "src/features": [{ path: "src/features/app.ts", name: "app.ts", type: "file" }],
      },
      workspaceDirectoryStatus: {
        src: "M",
        "src/features": "M",
      },
      workspaceStatusItems: {
        "src/features/app.ts": { code: "A" },
      },
      expandedWorkspaceDirs: {
        "src/features": true,
      },
      workspacePreview: {
        path: "src/features/app.ts",
      },
      toggleWorkspaceDirectory: () => {},
      openWorkspaceFile: () => Promise.resolve(),
      copyWorkspacePathToClipboard: () => Promise.resolve(),
    })
  );

  assert.match(html, /src\/features/);
  assert.match(html, /workspace-tree-item directory expanded/);
  assert.match(html, /workspace-tree-item file selected status-a/);
  assert.match(html, /app\.ts/);
});
