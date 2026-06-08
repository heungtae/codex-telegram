import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import TopTabs from "../TopTabs.js";

test("TopTabs renders project and turn tabs with UI Kit icon buttons", () => {
  const html = renderToStaticMarkup(
    React.createElement(TopTabs, {
      projectTabs: [{ id: "project:one", name: "One" }],
      activeProjectTabId: "project:one",
      projectTabStatusById: { "project:one": "running" },
      onSelectProjectTab: () => {},
      onCloseProjectTab: () => {},
      threadTabs: [{ id: "thread-1", title: "Thread One", status: "completed", hasUnreadCompletion: true }],
      activeThread: "thread-1",
      onSelectThread: () => {},
      onCloseThread: () => {},
      onAddThread: () => {},
      disableAddThread: true,
    })
  );

  assert.match(html, /project-tab-chip active state-running/);
  assert.match(html, /turn-tab-chip active state-completed unread/);
  assert.match(html, /ui-icon-button project-tab-close/);
  assert.match(html, /ui-icon-button turn-tab-close/);
  assert.match(html, /ui-icon-button turn-tab-add/);
  assert.match(html, /disabled=""/);
});
