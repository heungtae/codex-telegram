import AppWorkspacePanelSlot from "../components/AppWorkspacePanelSlot";
import { AGENT_CONFIG_DEFS } from "../../common/constants";
import {
  FolderIcon,
  MenuIcon,
  NewChatIcon,
  SendIcon,
  StopIcon,
} from "../../common/components/Icons";
import { persistTurnNotificationEnabled } from "../../common/theme";
import { getSidebarStyle } from "../state/layoutSelectors";

type RuntimeContextSlices = {
  domains: Record<string, unknown>;
  runtime: Record<string, unknown>;
  presentation: Record<string, unknown>;
};

export function buildAppRuntimeContextValue({
  domains,
  runtime,
  presentation,
}: RuntimeContextSlices) {
  return { domains, runtime, presentation };
}

export function buildConversationViewModel<
  TTabs extends object,
  TWorkspace extends object,
  TConversation extends object,
  TComposer extends object,
  TIcons extends object,
>({
  tabs,
  workspace,
  conversation,
  composer,
  icons,
}: {
  tabs: TTabs;
  workspace: TWorkspace;
  conversation: TConversation;
  composer: TComposer;
  icons: TIcons;
}): { tabs: TTabs; workspace: TWorkspace; conversation: TConversation; composer: TComposer; icons: TIcons } {
  return { tabs, workspace, conversation, composer, icons };
}

export default function useAppRuntimePresentation(args) {
  const {
    theme,
    onToggleTheme,
    domains,
    domainRuntime,
    composerRuntime,
    effectsRuntime,
    sidebarCollapsedWidth,
  } = args;
  const { threads, session, ui, approvals } = domains;
  const {
    activeProjectKey,
    activeProjectTab,
    activeSubagents,
    projectTabStatusById,
    workspace,
    threadActions,
    agentActions,
    refs,
    renderItems,
    interactionBusy,
    showToast,
  } = domainRuntime;
  const { composerViewModel } = composerRuntime;
  const { resetWorkspacePreviewSize, projectPicker } = effectsRuntime;

  const activeAgentDef = session.activeAgentSettings
    ? AGENT_CONFIG_DEFS[session.activeAgentSettings]
    : null;
  const activeAgentConfig = session.activeAgentSettings
    ? session.agentConfigs[session.activeAgentSettings]
    : null;
  const guardianRuleSummary =
    session.activeAgentSettings === "guardian"
      ? (activeAgentConfig?.rule_summary || {
          enabled: 0,
          total: 0,
          action_counts: {},
          top: [],
        })
      : null;
  const settingsBusy = !!session.agentConfigLoading || !!session.agentConfigSaving;
  const activeThreadTabs = threads.threadTabsByProjectTabId[threads.activeProjectTabId] || [];
  const selectProjectTab = (tabId) => {
    threads.setActiveProjectTabId(tabId);
    if (ui.isMobileLayout) {
      ui.setIsSidebarOpen(false);
    }
  };
  const closeThreadTab = (threadId) =>
    threadActions.closeThreadTab(threads.activeProjectTabId, threadId);
  const addThread = () => threadActions.startThread().catch(() => {});
  const selectThread = (projectTabId, threadId) => {
    if (projectTabId !== threads.activeProjectTabId) {
      threads.setActiveProjectTabId(projectTabId);
    }
    threadActions.viewThread(threadId, projectTabId);
    if (ui.isMobileLayout) {
      ui.setIsSidebarOpen(false);
    }
  };
  const closeThread = (projectTabId, threadId) =>
    threadActions.closeThreadTab(projectTabId, threadId);
  const startThread = (projectTabId) => {
    const projectTab = threads.projectTabs.find((tab) => tab.id === projectTabId);
    const projectKey = typeof projectTab?.key === "string" ? projectTab.key : "";
    if (projectTabId !== threads.activeProjectTabId) {
      threads.setActiveProjectTabId(projectTabId);
    }
    threadActions.startThread({}, projectTabId, projectKey).catch(() => {});
  };
  const disableAddThread = !activeProjectKey || interactionBusy;
  const workspacePanel = (
    <AppWorkspacePanelSlot
      isCompactWorkspaceLayout={ui.isCompactWorkspaceLayout}
      isWorkspacePanelOpen={ui.isWorkspacePanelOpen}
      workspacePanelWidth={workspace.workspacePanelWidth}
      activeWorkspacePath={activeProjectTab?.path || session.sessionSummary?.workspace || ""}
      workspaceError={workspace.workspaceError}
      workspaceStatus={workspace.workspaceStatus}
      workspaceTree={workspace.workspaceTree}
      expandedWorkspaceDirs={workspace.expandedWorkspaceDirs}
      workspacePreview={workspace.workspacePreview}
      toggleWorkspaceDirectory={workspace.toggleWorkspaceDirectory}
      openWorkspaceFile={workspace.openWorkspaceFile}
      refreshWorkspaceBrowser={workspace.refreshWorkspaceBrowser}
      setWorkspaceError={workspace.setWorkspaceError}
      showToast={showToast}
    />
  );

  const isDesktopSidebarCollapsed = !ui.isMobileLayout && ui.isSidebarCollapsed;
  const sidebarStyle = getSidebarStyle({
    isMobileLayout: ui.isMobileLayout,
    isDesktopSidebarCollapsed,
    sidebarWidth: ui.sidebarWidth,
    collapsedWidth: sidebarCollapsedWidth,
  });
  const contextValue = buildAppRuntimeContextValue({
    domains: {
      ui: {
        isMobileLayout: ui.isMobileLayout,
        isSidebarOpen: ui.isSidebarOpen,
        isResizingSidebar: ui.isResizingSidebar,
        isSidebarCollapsed: ui.isSidebarCollapsed,
        sidebarWidth: ui.sidebarWidth,
        turnNotificationEnabled: ui.turnNotificationEnabled,
        isProjectModeModalOpen: ui.isProjectModeModalOpen,
        shortcutModalPage: ui.shortcutModalPage,
        projectSearchQuery: ui.projectSearchQuery,
        selectedProjectIndex: ui.selectedProjectIndex,
        toastNotification: ui.toastNotification,
        setIsSidebarOpen: ui.setIsSidebarOpen,
        setIsResizingSidebar: ui.setIsResizingSidebar,
        setIsSidebarCollapsed: ui.setIsSidebarCollapsed,
        setTurnNotificationEnabled: ui.setTurnNotificationEnabled,
        setProjectSearchQuery: ui.setProjectSearchQuery,
        setSelectedProjectIndex: ui.setSelectedProjectIndex,
      },
      session: {
        sessionSummary: session.sessionSummary,
        agentConfigs: session.agentConfigs,
        agentConfigRawEditors: session.agentConfigRawEditors,
        activeAgentSettings: session.activeAgentSettings,
        floatingAgentSettings: session.floatingAgentSettings,
        agentConfigLoading: session.agentConfigLoading,
        agentConfigSaving: session.agentConfigSaving,
        agentConfigError: session.agentConfigError,
        setAgentConfigRawEditors: session.setAgentConfigRawEditors,
        setFloatingAgentSettings: session.setFloatingAgentSettings,
        setAgentConfigError: session.setAgentConfigError,
      },
      threads: {
        projectItems: threads.projectItems,
        activeProjectKey,
        threadItems: threads.threadItems,
        projectTabs: threads.projectTabs,
        activeProjectTabId: threads.activeProjectTabId,
        projectTabStatusById,
        threadTabsByProjectTabId: threads.threadTabsByProjectTabId,
        activeThread: threads.activeThread,
      },
    },
    runtime: {
      agent: {
        toggleAgent: agentActions.toggleAgent,
        openAgentSettings: agentActions.openAgentSettings,
        updateAgentDraft: agentActions.updateAgentDraft,
        toggleFloatingAgentSettings: agentActions.toggleFloatingAgentSettings,
        loadAgentConfig: agentActions.loadAgentConfig,
        setAgentConfigError: session.setAgentConfigError,
        saveAgentSettings: agentActions.saveAgentSettings,
      },
      thread: {
        selectProject: threadActions.selectProject,
        selectProjectTab,
        closeProjectTab: threadActions.closeProjectTab,
        selectThread,
        closeThread,
        startThread,
      },
      projectPicker: {
        closeProjectModeModal: projectPicker.closeProjectModeModal,
        chooseProjectClickMode: threadActions.chooseProjectClickMode,
        selectProjectFromPicker: projectPicker.selectProjectFromPicker,
        closeProjectPickerModal: projectPicker.closeProjectPickerModal,
      },
    },
    presentation: {
      shell: {
        theme,
        onToggleTheme,
        persistTurnNotificationEnabled,
      },
      sidebar: {
        isDesktopSidebarCollapsed,
        sidebarStyle,
        interactionBusy,
        activeSubagents,
        activeAgentDef,
        activeAgentConfig,
        guardianRuleSummary,
        settingsBusy,
      },
      projectPicker: {
        filteredProjects: projectPicker.filteredProjects,
      },
    },
  });
  const conversation = buildConversationViewModel({
    tabs: {
      projectTabs: threads.projectTabs,
      activeProjectTabId: threads.activeProjectTabId,
      projectTabStatusById,
      onSelectProjectTab: selectProjectTab,
      onCloseProjectTab: threadActions.closeProjectTab,
      threadTabs: activeThreadTabs,
      activeThread: threads.activeThread,
      onSelectThread: threadActions.viewThread,
      onCloseThread: closeThreadTab,
      onAddThread: addThread,
      disableAddThread,
    },
    workspace: {
      workspacePreview: workspace.workspacePreview,
      isResizingWorkspacePreview: workspace.isResizingWorkspacePreview,
      isMobileLayout: ui.isMobileLayout,
      workspacePreviewWidth: workspace.workspacePreviewWidth,
      workspacePreviewHeight: workspace.workspacePreviewHeight,
      workspacePreviewResizeRef: refs.workspacePreviewResizeRef,
      setIsResizingWorkspacePreview: workspace.setIsResizingWorkspacePreview,
      setWorkspacePreview: workspace.setWorkspacePreview,
      resetWorkspacePreviewSize,
      workspacePanel,
      isResizingWorkspacePanel: workspace.isResizingWorkspacePanel,
      onStartWorkspacePanelResize: (event) => {
        refs.workspaceResizeRef.current = {
          startX: event.clientX,
          startWidth: workspace.workspacePanelWidth,
        };
        workspace.setIsResizingWorkspacePanel(true);
      },
    },
    conversation: {
      chatRef: refs.chatRef,
      approvalItems: approvals.approvalItems,
      approvalBusyId: approvals.approvalBusyId,
      onSubmitApproval: approvals.submitApproval,
      onCloseApprovals: () => approvals.setApprovalItems([]),
      renderItems,
    },
    composer: composerViewModel,
    icons: {
      StopIcon,
      SendIcon,
      FolderIcon,
      NewChatIcon,
    },
  });

  return {
    contextValue,
    layout: {
      isMobileLayout: ui.isMobileLayout,
      isSidebarOpen: ui.isSidebarOpen,
      onToggleSidebarOpen: ui.setIsSidebarOpen,
      MenuIcon,
    },
    conversation,
  };
}
