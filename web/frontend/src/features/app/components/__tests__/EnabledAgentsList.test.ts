import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import EnabledAgentsList from "../EnabledAgentsList";

test("EnabledAgentsList renders enabled agents as read-only rows", () => {
  const html = renderToStaticMarkup(
    React.createElement(EnabledAgentsList, {
      agents: [
        { name: "guardian", enabled: true },
        { name: "logger", enabled: false },
      ],
    })
  );

  assert.match(html, /guardian/);
  assert.match(html, /enabled/);
  assert.match(html, /logger/);
  assert.match(html, /disabled/);
  assert.match(html, /class="agent-item static on"/);
  assert.match(html, /class="agent-item static off"/);
  assert.match(html, /class="thread-list agent-list enabled-agents-list"/);
  assert.doesNotMatch(html, /button/);
});
