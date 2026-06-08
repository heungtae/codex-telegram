import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import SidebarHeaderActions from "../SidebarHeaderActions";

test("SidebarHeaderActions renders brand and action controls", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarHeaderActions, {
      turnNotificationEnabled: true,
      setTurnNotificationEnabled: () => {},
      persistTurnNotificationEnabled: () => {},
      onToggleTheme: () => {},
      theme: "dark",
    })
  );

  assert.match(html, /Codex Web/);
  assert.match(html, /ui-icon-button is-active notify-toggle icon-only on/);
  assert.match(html, /ui-icon-button theme-toggle icon-only/);
  assert.match(html, /Toggle turn completion notification/);
  assert.match(html, /Toggle theme/);
});
