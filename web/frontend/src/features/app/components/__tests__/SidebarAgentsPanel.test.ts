import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import SidebarAgentsPanel from "../SidebarAgentsPanel";

test("SidebarAgentsPanel renders agents, active subagents, guardian settings, then rules", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarAgentsPanel, {
      sessionSummary: { agents: [{ name: "guardian", enabled: true }] },
      toggleAgent: () => {},
      agentConfigLoading: false,
      agentConfigSaving: false,
      openAgentSettings: () => {},
      activeSubagents: [{ thread_id: "sub-thread", name: "reviewer", status: "active" }],
      agentConfigError: "",
      activeAgentDef: {
        title: "Guardian",
        fields: [{ key: "timeout_seconds", label: "Timeout", options: [3, 20] }],
      },
      activeAgentConfig: { enabled: true, timeout_seconds: 20 },
      settingsBusy: false,
      updateAgentDraft: () => {},
      activeAgentSettings: "guardian",
      guardianRuleSummary: {
        enabled: 1,
        total: 2,
        action_counts: { approve: 1 },
        top: [{ name: "allow-safe", action: "approve", priority: 1 }],
      },
      floatingAgentSettings: "",
      toggleFloatingAgentSettings: () => {},
      loadAgentConfig: () => Promise.resolve(),
      setAgentConfigError: () => {},
      saveAgentSettings: () => Promise.resolve(),
    })
  );

  assert.match(html, /guardian/);
  assert.match(html, /Running Subagents/);
  assert.match(html, /reviewer/);
  assert.match(html, />20</);
  assert.match(html, /1 of 2 enabled/);

  const guardianIndex = html.indexOf("Guardian");
  const rulesIndex = html.indexOf(">Rules<");
  assert.ok(guardianIndex >= 0);
  assert.ok(rulesIndex > guardianIndex);
});
