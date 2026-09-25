import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AppRuntimeProvider from "../../context/AppRuntimeProvider";
import AppSidebarContainer from "../AppSidebarContainer";

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
              projectItems: [{ key: "project-a", name: "Project A", path: "/workspace/project-a", default: false }],
              activeProjectKey: "project-a",
              projectTabs: [{ id: "project:project-a", key: "project-a", name: "Open Project A", path: "/workspace/project-a" }],
              activeProjectTabId: "project:project-a",
              projectTabStatusById: { "project:project-a": "running" },
              threadItems: [{ id: "thread-open", title: "Open Thread" }],
              threadTabsByProjectTabId: {
                "project:project-a": [{ id: "thread-open", title: "Open Thread", status: "idle" }],
                "project:project-b": [{ id: "thread-other", title: "Other Project Thread", status: "idle" }],
              },
              activeThread: "thread-open",
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
              selectProjectTab: () => {},
              closeProjectTab: () => {},
              selectThread: () => {},
              closeThread: () => {},
              startThread: () => {},
            },
          },
          presentation: {
            shell: {
              appVersion: "0.5.0",
              theme: "dark",
              onToggleTheme: () => {},
              persistTurnNotificationEnabled: () => {},
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
  assert.match(html, /Open Thread/);
  assert.match(html, /Codex Bridge/);
  assert.match(html, /Settings\(ver\.0\.5\.0\)/);
  assert.doesNotMatch(html, /Other Project Thread/);
});
