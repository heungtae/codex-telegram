import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AppFloatingAgentSettingsPane from "../AppFloatingAgentSettingsPane";

test("AppFloatingAgentSettingsPane renders guardian rules editor from draft state", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppFloatingAgentSettingsPane, {
      activeAgentSettings: "guardian",
      floatingAgentSettings: "guardian",
      agentConfigs: { guardian: { enabled: true, rules: [] } },
      agentConfigRawEditors: { guardian: "allow = true" },
      settingsBusy: false,
      setFloatingAgentSettings: () => {},
      setAgentConfigRawEditors: () => {},
      loadAgentConfig: () => Promise.resolve(),
      saveAgentSettings: () => Promise.resolve(),
      setAgentConfigError: () => {},
    })
  );

  assert.match(html, /Guardian Rules TOML/);
  assert.match(html, /allow = true/);
});
