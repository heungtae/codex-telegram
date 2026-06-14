import AppSidebarPane from "../components/AppSidebarPane";
import {
  useAppDomainsContext,
  useAppPresentationContext,
  useAppRuntimeContext,
} from "../context/AppRuntimeContext";
import type {
  ProjectTab,
  ThreadTabsByProjectTabId,
} from "../hooks/useProjectThreadTabs.types.js";

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

  return (
    <AppSidebarPane
      isMobileLayout={ui.isMobileLayout}
      isSidebarOpen={ui.isSidebarOpen}
      isDesktopSidebarCollapsed={sidebar.isDesktopSidebarCollapsed}
      sidebarStyle={sidebar.sidebarStyle}
      isResizingSidebar={ui.isResizingSidebar}
      onToggleSidebarOpen={ui.setIsSidebarOpen}
      onToggleSidebarCollapsed={() => ui.setIsSidebarCollapsed((current) => !current)}
      onStartSidebarResize={() => ui.setIsResizingSidebar(true)}
      turnNotificationEnabled={ui.turnNotificationEnabled}
      setTurnNotificationEnabled={ui.setTurnNotificationEnabled}
      persistTurnNotificationEnabled={shell.persistTurnNotificationEnabled}
      onToggleTheme={shell.onToggleTheme}
      theme={shell.theme}
      sessionSummary={session.sessionSummary}
      toggleAgent={agent.toggleAgent}
      agentConfigLoading={session.agentConfigLoading}
      agentConfigSaving={session.agentConfigSaving}
      openAgentSettings={agent.openAgentSettings}
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
      interactionBusy={sidebar.interactionBusy}
      projectItems={threads.projectItems}
      selectProject={thread.selectProject}
      projectTabs={threads.projectTabs}
      activeProjectTabId={threads.activeProjectTabId}
      projectTabStatusById={threads.projectTabStatusById}
      onSelectProjectTab={thread.selectProjectTab}
      onCloseProjectTab={thread.closeProjectTab}
      threadItems={threads.threadItems}
      threadTabsByProjectTabId={threads.threadTabsByProjectTabId}
      activeThread={threads.activeThread}
      onSelectThread={thread.selectThread}
      onCloseThread={thread.closeThread}
      onAddThread={thread.startThread}
      disableAddThread={!threads.activeProjectKey || sidebar.interactionBusy}
    />
  );
}
