import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AppRuntimeProvider from "../../context/AppRuntimeProvider";
import AppSidebarContainer from "../AppSidebarContainer";

function Icon() {
  return React.createElement("span", null, "icon");
}

test("AppSidebarContainer consumes runtime slices and renders sidebar content", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      AppRuntimeProvider,
      {
        value: {
          domains: {
            ui: {
              isMobileLayout: false,
              isSidebarOpen: true,
              isResizingSidebar: false,
              isSidebarCollapsed: false,
              sidebarWidth: 340,
              turnNotificationEnabled: true,
              setIsSidebarOpen: () => {},
              setIsSidebarCollapsed: () => {},
              setIsResizingSidebar: () => {},
              setTurnNotificationEnabled: () => {},
            },
            session: {
              sessionSummary: { agents: [] },
              agentConfigLoading: false,
              agentConfigSaving: false,
              agentConfigError: "",
              activeAgentSettings: "",
              floatingAgentSettings: "",
              agentConfigs: {},
            },
            threads: {
              projectItems: [{ key: "project-a", name: "Project A" }],
              activeProjectKey: "project-a",
              threadItems: [{ id: "thread-a", title: "Thread A" }],
              activeThread: "thread-a",
            },
          },
          runtime: {
            agent: {
              toggleAgent: () => {},
              openAgentSettings: () => {},
              updateAgentDraft: () => {},
              toggleFloatingAgentSettings: () => {},
              loadAgentConfig: () => Promise.resolve(),
              setAgentConfigError: () => {},
              saveAgentSettings: () => Promise.resolve(),
            },
            thread: {
              selectProject: () => Promise.resolve(),
              viewThread: () => Promise.resolve(),
            },
          },
          presentation: {
            shell: {
              theme: "dark",
              onToggleTheme: () => {},
              persistTurnNotificationEnabled: () => {},
              SidebarChevronIcon: Icon,
            },
            sidebar: {
              isDesktopSidebarCollapsed: false,
              sidebarStyle: { width: 340 },
              interactionBusy: false,
              activeAgentDef: null,
              activeAgentConfig: null,
              guardianRuleSummary: null,
              settingsBusy: false,
            },
          },
        },
      },
      React.createElement(AppSidebarContainer)
    )
  );

  assert.match(html, /Project A/);
  assert.match(html, /Thread A/);
  assert.match(html, /Codex Web/);
});
