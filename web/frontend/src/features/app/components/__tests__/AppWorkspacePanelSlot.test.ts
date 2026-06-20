import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AppWorkspacePanelSlot from "../AppWorkspacePanelSlot";

test("AppWorkspacePanelSlot renders the active preview before project structure", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppWorkspacePanelSlot, {
      isCompactWorkspaceLayout: false,
      isWorkspacePanelOpen: true,
      workspacePanelWidth: 360,
      activeProjectKey: "default",
      activeWorkspacePath: "C:/Project/codex-telegram",
      workspaceError: "",
      workspaceStatus: { items: { "README.md": { code: "M" } } },
      workspaceTree: {
        "": [{ path: "README.md", type: "file" }],
      },
      expandedWorkspaceDirs: {},
      workspacePreview: {
        path: "README.md",
        mode: "file",
        status: "",
        loading: false,
        content: "hello",
        diff: "",
        previewAvailable: true,
        error: "",
        truncated: false,
        isBinary: false,
      },
      toggleWorkspaceDirectory: () => {},
      openWorkspaceFile: () => {},
      refreshWorkspaceBrowser: () => {},
      setWorkspaceError: () => {},
      showToast: () => {},
    })
  );

  assert.match(html, /README\.md/);
  assert.match(html, /class="workspace-file-tab active"/);
  assert.match(html, /class="workspace-preview-panel file-mode workspace-preview-inline"/);
  assert.ok(
    html.indexOf("workspace-preview-inline") < html.indexOf("workspace-structure-panel"),
    "preview should render before project structure"
  );
  assert.match(html, /hello/);
});

test("AppWorkspacePanelSlot renders desktop sidebar controls without explorer open action", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppWorkspacePanelSlot, {
      isCompactWorkspaceLayout: false,
      isWorkspacePanelOpen: true,
      workspacePanelWidth: 320,
      activeProjectKey: "default",
      activeWorkspacePath: "C:/Project/codex-telegram",
      workspaceError: "",
      workspaceStatus: { items: {} },
      workspaceTree: {
        "": [{ path: "src", name: "src", type: "directory" }],
      },
      expandedWorkspaceDirs: {},
      workspacePreview: null,
      toggleWorkspaceDirectory: () => {},
      openWorkspaceFile: () => {},
      refreshWorkspaceBrowser: () => {},
      setWorkspaceError: () => {},
      showToast: () => {},
    })
  );

  assert.match(html, /class="workspace-panel-collapse"/);
  assert.match(html, /aria-label="Collapse workspace panel"/);
  assert.match(html, /placeholder="Filter files\.\.\."/);
  assert.doesNotMatch(html, /class="workspace-open-button"/);
  assert.doesNotMatch(html, />Open</);
  assert.doesNotMatch(html, /class="workspace-panel-breadcrumb"/);
});
