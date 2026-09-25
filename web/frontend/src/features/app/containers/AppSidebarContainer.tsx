import { useEffect } from "react";
import AppSidebarFrame from "../components/AppSidebarFrame";
import SidebarAgentsPanel from "../components/SidebarAgentsPanel";
import SidebarHeaderActions from "../components/SidebarHeaderActions";
import SidebarProjectsPanel from "../components/SidebarProjectsPanel";
import SidebarThreadsPanel from "../components/SidebarThreadsPanel";
import { createOpenExplorerPayload } from "../state/projectExplorer.js";
import { buildProjectRows } from "../state/projectRows.js";
import {
  useAppDomainsContext,
  useAppPresentationContext,
  useAppRuntimeContext,
} from "../context/AppRuntimeContext";
import type {
  ProjectTab,
  ThreadTabsByProjectTabId,
} from "../hooks/useProjectThreadTabs";

type Callback = (...args: unknown[]) => void;
type AsyncCallback = (...args: unknown[]) => Promise<unknown>;
type ProjectItem = {
  key: string;
  name: string;
  path: string;
  default?: boolean;
};
type ThreadItem = {
  id: string;
  title: string;
  status?: string;
  hasUnreadCompletion?: boolean;
};

type SidebarDomains = {
  ui: {
    isMobileLayout: boolean;
    isSidebarOpen: boolean;
    isResizingSidebar: boolean;
    turnNotificationEnabled: boolean;
    setIsSidebarOpen: Callback;
    setIsSidebarCollapsed: Callback;
    setIsResizingSidebar: Callback;
    setTurnNotificationEnabled: Callback;
  };
  session: {
    sessionSummary: unknown;
    agentConfigLoading: unknown;
    agentConfigSaving: unknown;
    agentConfigError: unknown;
    activeAgentSettings: unknown;
    floatingAgentSettings: unknown;
  };
  threads: {
    projectItems: ProjectItem[];
    activeProjectKey: string;
    projectTabs: ProjectTab[];
    activeProjectTabId: string;
    projectTabStatusById: Record<string, string>;
    threadItems: ThreadItem[];
    threadTabsByProjectTabId: ThreadTabsByProjectTabId;
    activeThread: string;
    telegramActiveThreadId: string;
  };
};

type SidebarRuntime = {
  agent: {
    toggleAgent: Callback;
    openAgentSettings: Callback;
    updateAgentDraft: Callback;
    toggleFloatingAgentSettings: Callback;
    loadAgentConfig: AsyncCallback;
    setAgentConfigError: Callback;
    saveAgentSettings: AsyncCallback;
  };
  thread: {
    selectProject: AsyncCallback;
    selectProjectTab: Callback;
    closeProjectTab: Callback;
    selectThread: Callback;
    closeThread: Callback;
    startThread: Callback;
  };
};

type SidebarPresentation = {
  shell: {
    appVersion?: string;
    theme: unknown;
    onToggleTheme: Callback;
    persistTurnNotificationEnabled: Callback;
  };
  sidebar: {
    isDesktopSidebarCollapsed: boolean;
    sidebarStyle: unknown;
    interactionBusy: boolean;
    activeSubagents?: unknown[];
    activeAgentDef: unknown;
    activeAgentConfig: unknown;
    guardianRuleSummary: unknown;
    settingsBusy: boolean;
  };
};

export default function AppSidebarContainer() {
  const { session, threads, ui } = useAppDomainsContext<SidebarDomains>();
  const { agent, thread } = useAppRuntimeContext<SidebarRuntime>();
  const { shell, sidebar } = useAppPresentationContext<SidebarPresentation>();

  useEffect(() => {
    const agents = (session.sessionSummary as { agents?: { name: string }[] } | null)?.agents || [];
    if (agents.some((a) => a.name === "guardian") && !session.activeAgentSettings) {
      agent.openAgentSettings("guardian");
    }
  }, [session.sessionSummary, session.activeAgentSettings, agent.openAgentSettings]);

  return (
    <AppSidebarFrame
      isMobileLayout={ui.isMobileLayout}
      isSidebarOpen={ui.isSidebarOpen}
      isDesktopSidebarCollapsed={sidebar.isDesktopSidebarCollapsed}
      sidebarStyle={sidebar.sidebarStyle}
      isResizingSidebar={ui.isResizingSidebar}
      appVersion={shell.appVersion}
      onToggleSidebarOpen={ui.setIsSidebarOpen}
      onToggleSidebarCollapsed={() => ui.setIsSidebarCollapsed((current) => !current)}
      onStartSidebarResize={() => ui.setIsResizingSidebar(true)}
      settingsContent={
        <SidebarAgentsPanel
          toggleAgent={agent.toggleAgent}
          agentConfigLoading={session.agentConfigLoading}
          agentConfigSaving={session.agentConfigSaving}
          activeSubagents={sidebar.activeSubagents || []}
          agentConfigError={session.agentConfigError}
          activeAgentDef={sidebar.activeAgentDef}
          activeAgentConfig={sidebar.activeAgentConfig}
          settingsBusy={sidebar.settingsBusy}
          updateAgentDraft={agent.updateAgentDraft}
          activeAgentSettings={session.activeAgentSettings}
          guardianRuleSummary={sidebar.guardianRuleSummary}
          floatingAgentSettings={session.floatingAgentSettings}
          toggleFloatingAgentSettings={agent.toggleFloatingAgentSettings}
          loadAgentConfig={agent.loadAgentConfig}
          setAgentConfigError={agent.setAgentConfigError}
          saveAgentSettings={agent.saveAgentSettings}
        />
      }
    >
      <SidebarHeaderActions
        turnNotificationEnabled={ui.turnNotificationEnabled}
        setTurnNotificationEnabled={ui.setTurnNotificationEnabled}
        persistTurnNotificationEnabled={shell.persistTurnNotificationEnabled}
        onToggleTheme={shell.onToggleTheme}
        theme={shell.theme}
        onToggleSidebarOpen={ui.setIsSidebarOpen}
        onToggleSidebarCollapsed={() => ui.setIsSidebarCollapsed((current) => !current)}
        isMobileLayout={ui.isMobileLayout}
      />
      <SidebarProjectsPanel
        projectRows={buildProjectRows({
          projectItems: threads.projectItems,
          projectTabs: threads.projectTabs,
          threadTabsByProjectTabId: threads.threadTabsByProjectTabId,
          projectTabStatusById: threads.projectTabStatusById,
          activeProjectTabId: threads.activeProjectTabId,
        })}
        activeThread={threads.activeThread}
        telegramActiveThreadId={threads.telegramActiveThreadId}
        interactionBusy={sidebar.interactionBusy}
        disableAddThread={!threads.activeProjectKey || sidebar.interactionBusy}
        onSelectProject={(key) => (thread.selectProject as (k: string) => Promise<unknown>)(key).catch(() => {})}
        onSelectProjectTab={thread.selectProjectTab}
        onCloseProjectTab={thread.closeProjectTab}
        onSelectThread={thread.selectThread}
        onCloseThread={thread.closeThread}
        onAddThread={thread.startThread}
        onOpenInExplorer={(projectKey) =>
          fetch("/api/projects/open-explorer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(createOpenExplorerPayload(projectKey)),
          }).catch(() => {})
        }
      />
      <SidebarThreadsPanel
        activeProjectTabId={threads.activeProjectTabId}
        threadItems={threads.threadItems}
        threadTabsByProjectTabId={threads.threadTabsByProjectTabId}
        activeThread={threads.activeThread}
        onSelectThread={thread.selectThread}
        onCloseThread={thread.closeThread}
        onAddThread={thread.startThread}
        disableAddThread={!threads.activeProjectKey || sidebar.interactionBusy}
      />
    </AppSidebarFrame>
  );
}
