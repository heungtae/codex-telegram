import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AppRuntimeProvider from "../../context/AppRuntimeProvider";
import AppFloatingAgentSettingsContainer from "../AppFloatingAgentSettingsContainer";

test("AppFloatingAgentSettingsContainer consumes agent settings slices", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      AppRuntimeProvider,
      {
        value: {
          domains: {
            session: {
              activeAgentSettings: "guardian",
              floatingAgentSettings: "guardian",
              agentConfigs: { guardian: { enabled: true, rules: [] } },
              agentConfigRawEditors: { guardian: "allow = true" },
              agentConfigLoading: false,
              agentConfigSaving: false,
              setFloatingAgentSettings: () => {},
              setAgentConfigRawEditors: () => {},
              setAgentConfigError: () => {},
            },
          },
          runtime: {
            agent: {
              loadAgentConfig: () => Promise.resolve(),
              saveAgentSettings: () => Promise.resolve(),
            },
          },
          presentation: {
            sidebar: {
              settingsBusy: false,
            },
          },
        },
      },
      React.createElement(AppFloatingAgentSettingsContainer)
    )
  );

  assert.match(html, /Guardian Rules TOML/);
  assert.match(html, /allow = true/);
});
