import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import GuardianRulesSummary from "../GuardianRulesSummary";

test("GuardianRulesSummary renders enabled status, non-zero actions, and configure action", () => {
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

  assert.match(html, />Rules</);
  assert.match(html, /1 of 2 enabled/);
  assert.match(html, /Approve/);
  assert.match(html, /Deny/);
  assert.doesNotMatch(html, /Session/);
  assert.doesNotMatch(html, /allow-safe/);
  assert.match(html, /Configure rules/);
  assert.match(html, /class="guardian-rules-configure active"/);
});

test("GuardianRulesSummary renders an always-visible empty rules section", () => {
  const html = renderToStaticMarkup(
    React.createElement(GuardianRulesSummary, {
      guardianRuleSummary: { enabled: 0, total: 0, action_counts: null, top: [] },
      floatingAgentSettings: "",
      toggleFloatingAgentSettings: () => {},
      settingsBusy: false,
    })
  );

  assert.match(html, /0 enabled/);
  assert.match(html, /No rules configured yet/);
  assert.match(html, /Configure rules/);
});
