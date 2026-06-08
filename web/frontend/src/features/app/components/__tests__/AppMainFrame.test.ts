import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AppMainFrame from "../AppMainFrame";

function MenuIcon() {
  return React.createElement("span", null, "menu");
}

test("AppMainFrame renders mobile menu as UI Kit icon button", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppMainFrame, {
      children: React.createElement("div", null, "content"),
      isMobileLayout: true,
      isSidebarOpen: false,
      onToggleSidebarOpen: () => {},
      MenuIcon,
    })
  );

  assert.match(html, /ui-icon-button menu-toggle icon-only/);
  assert.match(html, /aria-label="Toggle navigation menu"/);
  assert.match(html, /aria-expanded="false"/);
});
