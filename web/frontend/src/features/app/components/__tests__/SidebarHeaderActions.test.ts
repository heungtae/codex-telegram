import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import SidebarHeaderActions from "../SidebarHeaderActions";

const BASE_PROPS = {
  turnNotificationEnabled: true,
  setTurnNotificationEnabled: () => {},
  persistTurnNotificationEnabled: () => {},
  onToggleTheme: () => {},
  theme: "dark",
  onToggleSidebarOpen: () => {},
  onToggleSidebarCollapsed: () => {},
  isMobileLayout: false,
};

test("SidebarHeaderActions renders brand and action controls", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarHeaderActions, BASE_PROPS)
  );

  assert.match(html, /Codex Web/);
  assert.match(html, /ui-icon-button is-active notify-toggle icon-only on/);
  assert.match(html, /ui-icon-button theme-toggle icon-only/);
  assert.match(html, /Toggle turn completion notification/);
  assert.match(html, /Toggle theme/);
});

test("desktop 상태에서 collapse sidebar 버튼이 렌더된다", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarHeaderActions, BASE_PROPS)
  );

  assert.match(html, /sidebar-toggle-btn/);
  assert.match(html, /Collapse sidebar/);
});

test("모바일 상태에서 toggle btn label이 Close sidebar다", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarHeaderActions, { ...BASE_PROPS, isMobileLayout: true })
  );

  assert.match(html, /Close sidebar/);
});
