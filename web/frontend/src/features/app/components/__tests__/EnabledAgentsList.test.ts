import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import EnabledAgentsList from "../EnabledAgentsList";

test("EnabledAgentsList renders configurable and static agents with busy state", () => {
  const html = renderToStaticMarkup(
    React.createElement(EnabledAgentsList, {
      agents: [
        { name: "guardian", enabled: true },
        { name: "logger", enabled: false },
      ],
      toggleAgent: () => {},
      agentConfigLoading: false,
      agentConfigSaving: true,
      openAgentSettings: () => {},
    })
  );

  assert.match(html, /Enabled Agents/);
  assert.match(html, /guardian/);
  assert.match(html, /enabled/);
  assert.match(html, /logger/);
  assert.match(html, /disabled/);
  assert.match(html, /class="agent-item on clickable"/);
  assert.match(html, /class="agent-item off static"/);
  assert.match(html, /aria-label="guardian settings"/);
  assert.match(html, /disabled=""/);
});
