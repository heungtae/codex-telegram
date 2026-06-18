import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import WorkspacePanelHeader from "../WorkspacePanelHeader.js";

test("WorkspacePanelHeader renders root label and refresh action", () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkspacePanelHeader, {
      workspaceRootLabel: "codex-telegram",
      workspaceLeaf: "codex-telegram",
      refreshWorkspaceBrowser: () => Promise.resolve(),
      setWorkspaceError: () => {},
    })
  );

  assert.match(html, /Workspace/);
  assert.match(html, /codex-telegram/);
  assert.match(html, /aria-label="Refresh workspace browser"/);
});
