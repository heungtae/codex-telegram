import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ChatHeader from "../ChatHeader";

test("ChatHeader renders the active thread title and add action", () => {
  const html = renderToStaticMarkup(
    React.createElement(ChatHeader, {
      activeThreadTitle: "Thread One",
      onAddThread: () => {},
      disableAddThread: true,
    })
  );

  assert.match(html, /Thread One/);
  assert.match(html, /class="chat-header"/);
  assert.match(html, /aria-label="Add thread tab"/);
  assert.match(html, /disabled=""/);
  assert.doesNotMatch(html, /project-tab-chip/);
});
