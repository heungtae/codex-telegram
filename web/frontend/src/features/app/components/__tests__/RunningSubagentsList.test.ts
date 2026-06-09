import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import RunningSubagentsList from "../RunningSubagentsList";

test("RunningSubagentsList renders fallback labels and thread titles", () => {
  const html = renderToStaticMarkup(
    React.createElement(RunningSubagentsList, {
      activeSubagents: [
        {
          thread_id: "child-thread",
          parent_thread_id: "parent-thread",
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
  assert.match(html, /reviewer/);
  assert.match(html, /active/);
  assert.match(html, /thread: child-thread, parent: parent-thread/);
  assert.match(html, /subagent/);
});

test("RunningSubagentsList renders nothing when empty", () => {
  const html = renderToStaticMarkup(React.createElement(RunningSubagentsList, { activeSubagents: [] }));

  assert.equal(html, "");
});
