import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AppSidebarPane from "../AppSidebarPane";

test("AppSidebarPane renders sidebar chrome and content panel", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppSidebarPane, {
      isMobileLayout: false,
      isSidebarOpen: true,
      isDesktopSidebarCollapsed: false,
      sidebarStyle: { width: 320 },
      isResizingSidebar: false,
      onToggleSidebarOpen: () => {},
      onToggleSidebarCollapsed: () => {},
      onStartSidebarResize: () => {},
      turnNotificationEnabled: false,
      setTurnNotificationEnabled: () => {},
      persistTurnNotificationEnabled: () => {},
      onToggleTheme: () => {},
      theme: "dark",
      sessionSummary: { agents: [] },
      toggleAgent: () => {},
      agentConfigLoading: false,
      agentConfigSaving: false,
      openAgentSettings: () => {},
      activeSubagents: [],
      agentConfigError: "",
      activeAgentDef: null,
      activeAgentConfig: null,
      settingsBusy: false,
      updateAgentDraft: () => {},
      activeAgentSettings: "",
      guardianRuleSummary: null,
      floatingAgentSettings: "",
      toggleFloatingAgentSettings: () => {},
      loadAgentConfig: () => Promise.resolve(),
      setAgentConfigError: () => {},
      saveAgentSettings: () => Promise.resolve(),
      interactionBusy: false,
      projectItems: [{ key: "codex-telegram", name: "Codex Telegram" }],
      selectProject: () => Promise.resolve(),
      projectTabs: [{ id: "project:codex-telegram", name: "Codex Telegram Tab" }],
      activeProjectTabId: "project:codex-telegram",
      projectTabStatusById: {},
      onSelectProjectTab: () => {},
      onCloseProjectTab: () => {},
      threadItems: [{ id: "thread-1", title: "Thread One" }],
      threadTabsByProjectTabId: {
        "project:codex-telegram": [{ id: "thread-1", title: "Thread One" }],
      },
      activeThread: "thread-1",
      onSelectThread: () => {},
      onCloseThread: () => {},
      onAddThread: () => {},
      disableAddThread: false,
    })
  );

  assert.match(html, /Codex Web/);
  assert.match(html, /Codex Telegram/);
  assert.match(html, /Thread One/);
});
