import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AppSidebarPane from "../AppSidebarPane";

function ChevronIcon({ collapsed }) {
  return React.createElement("span", null, collapsed ? "collapsed" : "expanded");
}

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
      SidebarChevronIcon: ChevronIcon,
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
      activeProjectKey: "codex-telegram",
      selectProject: () => Promise.resolve(),
      threadItems: [{ id: "thread-1", title: "Thread One" }],
      activeThread: "thread-1",
      viewThread: () => {},
    })
  );

  assert.match(html, /Codex Web/);
  assert.match(html, /Codex Telegram/);
  assert.match(html, /Thread One/);
});
