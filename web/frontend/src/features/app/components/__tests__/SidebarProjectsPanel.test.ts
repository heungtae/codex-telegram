import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import SidebarProjectsPanel from "../SidebarProjectsPanel";

test("SidebarProjectsPanel renders active project and busy note", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarProjectsPanel, {
      interactionBusy: true,
      projectItems: [{ key: "codex-telegram", name: "Codex Telegram", default: true }],
      activeProjectKey: "codex-telegram",
      selectProject: () => Promise.resolve(),
    })
  );

  assert.match(html, /Projects/);
  assert.match(html, /Codex Telegram/);
  assert.match(html, /Project switch is unavailable/);
  assert.match(html, /class="ui-panel panel"/);
});

test("SidebarProjectsPanel renders empty state", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarProjectsPanel, {
      interactionBusy: false,
      projectItems: [],
      activeProjectKey: "",
      selectProject: () => Promise.resolve(),
    })
  );

  assert.match(html, /No projects configured/);
});
