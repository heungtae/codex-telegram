import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import SidebarThreadsPanel from "../SidebarThreadsPanel";

test("SidebarThreadsPanel renders active thread", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarThreadsPanel, {
      interactionBusy: false,
      threadItems: [{ id: "thread-1", title: "Thread One" }],
      activeThread: "thread-1",
      viewThread: () => {},
    })
  );

  assert.match(html, /Threads/);
  assert.match(html, /Thread One/);
  assert.match(html, /thread-1/);
});

test("SidebarThreadsPanel renders empty state", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarThreadsPanel, {
      interactionBusy: false,
      threadItems: [],
      activeThread: "",
      viewThread: () => {},
    })
  );

  assert.match(html, /No open threads/);
});
