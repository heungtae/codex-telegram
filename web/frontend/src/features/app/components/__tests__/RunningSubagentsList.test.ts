import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import RunningSubagentsList from "../RunningSubagentsList";

test("RunningSubagentsList renders a collapsible flat list with active status dots", () => {
  const html = renderToStaticMarkup(
    React.createElement(RunningSubagentsList, {
      activeSubagents: [
        {
          thread_id: "child-thread",
          parent_thread_id: "parent-thread",
          name: "atlas",
          role: "reviewer",
          status: "active",
        },
        {
          thread_id: "",
          name: "",
          role: "",
          status: "",
        },
      ],
    })
  );

  assert.match(html, /Running Subagents/);
  assert.match(html, /2 active/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /atlas/);
  assert.match(html, /reviewer/);
  assert.match(html, /active/);
  assert.match(html, /thread: child-thread, parent: parent-thread/);
  assert.match(html, /subagent/);
  assert.match(html, /class="running-subagent-status-dot"/);
  assert.match(html, /class="running-subagent-role">reviewer/);
  assert.doesNotMatch(html, /agent-item static on/);
});

test("RunningSubagentsList renders nothing when empty", () => {
  const html = renderToStaticMarkup(React.createElement(RunningSubagentsList, { activeSubagents: [] }));

  assert.equal(html, "");
});
