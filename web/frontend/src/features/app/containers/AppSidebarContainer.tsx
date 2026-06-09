import AppSidebarPane from "../components/AppSidebarPane";
import {
  useAppDomainsContext,
  useAppPresentationContext,
  useAppRuntimeContext,
} from "../context/AppRuntimeContext";

type Callback = (...args: unknown[]) => void;
type AsyncCallback = (...args: unknown[]) => Promise<unknown>;

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
    projectItems: unknown;
    activeProjectKey: unknown;
    threadItems: unknown;
    activeThread: unknown;
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
    viewThread: AsyncCallback;
  };
};

type SidebarPresentation = {
  shell: {
    theme: unknown;
    onToggleTheme: Callback;
    persistTurnNotificationEnabled: Callback;
    SidebarChevronIcon: unknown;
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
      SidebarChevronIcon={shell.SidebarChevronIcon}
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
      activeProjectKey={threads.activeProjectKey}
      selectProject={thread.selectProject}
      threadItems={threads.threadItems}
      activeThread={threads.activeThread}
      viewThread={thread.viewThread}
    />
  );
}
