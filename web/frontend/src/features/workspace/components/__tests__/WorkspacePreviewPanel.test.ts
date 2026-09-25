import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import WorkspacePreviewPanel from "../WorkspacePreviewPanel";

test("workspace preview only exposes the close action", () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkspacePreviewPanel, {
      workspacePreview: {
        mode: "file",
        path: "README.md",
        content: "preview",
        loading: false,
        error: "",
        previewAvailable: true,
      },
      onClose: () => {},
    }),
  );

  assert.match(html, /Close preview \(Esc\)/);
  assert.doesNotMatch(html, /Reset workspace preview size/);
  assert.doesNotMatch(html, /workspace-preview-reset/);
});
