import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import GuardianRulesSummary from "../GuardianRulesSummary";

test("GuardianRulesSummary renders counts, top rules, and active settings action", () => {
  const html = renderToStaticMarkup(
    React.createElement(GuardianRulesSummary, {
      guardianRuleSummary: {
        enabled: 1,
        total: 2,
        action_counts: { approve: 1, deny: 1 },
        top: [{ name: "allow-safe", action: "approve", priority: 3 }],
      },
      floatingAgentSettings: "guardian",
      toggleFloatingAgentSettings: () => {},
      settingsBusy: false,
    })
  );

  assert.match(html, /Rules: 1\/2 enabled/);
  assert.match(html, /approve: 1/);
  assert.match(html, /deny: 1/);
  assert.match(html, /allow-safe/);
  assert.match(html, /class="agent-settings-inline-btn active"/);
});

test("GuardianRulesSummary renders empty state without top rules", () => {
  const html = renderToStaticMarkup(
    React.createElement(GuardianRulesSummary, {
      guardianRuleSummary: { enabled: 0, total: 0, action_counts: null, top: [] },
      floatingAgentSettings: "",
      toggleFloatingAgentSettings: () => {},
      settingsBusy: false,
    })
  );

  assert.match(html, /No guardian policy rules configured/);
});
