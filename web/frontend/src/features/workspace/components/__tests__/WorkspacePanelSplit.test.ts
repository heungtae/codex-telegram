import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import WorkspacePanel from "../WorkspacePanel.js";

test("workspace panel places an adjustable divider between preview and tree", () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkspacePanel, {
      isCompactWorkspaceLayout: false,
      isWorkspacePanelOpen: true,
      onToggleWorkspacePanel: () => {},
      workspacePanelStyle: { width: "100%" },
      workspaceRootLabel: "project",
      workspaceError: "",
      activeWorkspacePath: "/project",
      workspaceStatusItems: {},
      workspaceTree: { "": [] },
      expandedWorkspaceDirs: {},
      workspacePreview: null,
      toggleWorkspaceDirectory: () => {},
      openWorkspaceFile: () => Promise.resolve(),
      refreshWorkspaceBrowser: () => Promise.resolve(),
      setWorkspaceError: () => {},
      showToast: () => {},
      isWorkspaceExpanded: false,
      onToggleWorkspaceExpand: () => {},
    })
  );

  const previewIndex = html.indexOf('class="workspace-file-viewer workspace-preview-pane"');
  const dividerIndex = html.indexOf('class="workspace-structure-resizer"');
  const treeIndex = html.indexOf('class="workspace-structure-panel"');
  assert.ok(previewIndex >= 0 && previewIndex < dividerIndex && dividerIndex < treeIndex);
  assert.match(html, /aria-label="Resize file preview and project structure"/);
  assert.match(html, /class="workspace-structure-panel"[^>]*style="width:240px"/);
});
