import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import WorkspaceDeletedEntries from "../WorkspaceDeletedEntries.js";

test("WorkspaceDeletedEntries renders deleted files and status badges", () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkspaceDeletedEntries, {
      deletedWorkspaceEntries: [
        ["old/file.txt", { code: "D" }],
        ["removed.md", null],
      ],
      openWorkspaceFile: () => Promise.resolve(),
      copyWorkspacePathToClipboard: () => Promise.resolve(),
    })
  );

  assert.match(html, /Deleted/);
  assert.match(html, /old\/file\.txt/);
  assert.match(html, /removed\.md/);
  assert.match(html, /workspace-tree-item file deleted/);
  assert.match(html, /workspace-tree-badge">D/);
});
