import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AgentSettingsCard from "../AgentSettingsCard";

test("AgentSettingsCard renders fields, enabled state, and actions", () => {
  const html = renderToStaticMarkup(
    React.createElement(AgentSettingsCard, {
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

  assert.match(html, /Guardian/);
  assert.match(html, /class="agent-status-chip on"/);
  assert.match(html, /Timeout/);
  assert.match(html, /value="10" selected/);
  assert.match(html, /Rules: 1\/2 enabled/);
  assert.match(html, /aria-label="Refresh"/);
  assert.match(html, /aria-label="Save"/);
});

test("AgentSettingsCard renders loading state without active config", () => {
  const html = renderToStaticMarkup(
    React.createElement(AgentSettingsCard, {
      activeAgentDef: {
        title: "Guardian",
        fields: [],
      },
      activeAgentConfig: null,
      settingsBusy: false,
      updateAgentDraft: () => {},
      activeAgentSettings: "guardian",
      guardianRuleSummary: {},
      floatingAgentSettings: "",
      toggleFloatingAgentSettings: () => {},
      loadAgentConfig: () => Promise.resolve(),
      setAgentConfigError: () => {},
      saveAgentSettings: () => Promise.resolve(),
    })
  );

  assert.match(html, /Loading settings/);
});
