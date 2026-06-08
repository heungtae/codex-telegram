import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import SidebarAgentsPanel from "../SidebarAgentsPanel";

test("SidebarAgentsPanel renders enabled agents, subagents, and guardian settings", () => {
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
        fields: [{ key: "timeout", label: "Timeout", options: [10, 20] }],
      },
      activeAgentConfig: { enabled: true, timeout: 10 },
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

  assert.match(html, /Enabled Agents/);
  assert.match(html, /guardian/);
  assert.match(html, /Running Subagents/);
  assert.match(html, /reviewer/);
  assert.match(html, /Rules: 1\/2 enabled/);
  assert.match(html, /class="ui-panel panel"/);
});
