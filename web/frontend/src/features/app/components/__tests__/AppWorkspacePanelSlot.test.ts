import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AppWorkspacePanelSlot from "../AppWorkspacePanelSlot";

test("AppWorkspacePanelSlot renders workspace panel with derived root label", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppWorkspacePanelSlot, {
      isCompactWorkspaceLayout: false,
      isWorkspacePanelOpen: true,
      workspacePanelWidth: 360,
      activeWorkspacePath: "C:/Project/codex-telegram",
      workspaceError: "",
      workspaceStatus: { items: { "README.md": { code: "M" } } },
      workspaceTree: {
        "": [{ path: "README.md", type: "file" }],
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

  assert.match(html, /codex-telegram/);
  assert.match(html, /README\.md/);
});
