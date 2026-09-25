import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AuthenticatedAppLayout from "../AuthenticatedAppLayout";

function Icon() {
  return React.createElement("span", null, "icon");
}

test("AuthenticatedAppLayout preserves overlay, sidebar, and main slots", () => {
  const html = renderToStaticMarkup(
    React.createElement(AuthenticatedAppLayout, {
      isMobileLayout: true,
      overlays: React.createElement("div", null, "Overlay Slot"),
      sidebar: React.createElement("nav", null, "Sidebar Slot"),
      main: React.createElement("section", null, "Main Slot"),
      isSidebarOpen: true,
      onToggleSidebarOpen: () => {},
      rightPanel: null,
      isWorkspacePanelOpen: false,
      isCompactWorkspaceLayout: true,
      isWorkspaceExpanded: false,
      isResizingWorkspacePanel: false,
      onStartWorkspacePanelResize: () => {},
      onToggleWorkspacePanel: () => {},
    })
  );

  assert.match(html, /mobile-layout/);
  assert.match(html, /Overlay Slot/);
  assert.match(html, /Sidebar Slot/);
  assert.match(html, /Main Slot/);
});
