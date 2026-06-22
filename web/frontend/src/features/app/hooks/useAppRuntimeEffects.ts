import { useEffect } from "react";
import { api } from "../../common/api";
import {
  formatPlanChecklistText,
  normalizeThreadId,
  summarizeReasoningStatus,
} from "../../common/utils";
import useAppUiEffects from "./useAppUiEffects";
import useChatScrollEffects from "./useChatScrollEffects";
import useGlobalKeyboardShortcuts from "./useGlobalKeyboardShortcuts";
import useProjectPickerViewModel from "./useProjectPickerViewModel";
import useResizeInteractions from "./useResizeInteractions";
import useThreadBootstrapEffects from "./useThreadBootstrapEffects";
import useTurnMessageMutations from "./useTurnMessageMutations";
import useTurnSession from "./useTurnSession";
import useViewportLayout from "./useViewportLayout";
import { normalizeCollaborationMode } from "./useAppDomainRuntime";
import {
  WORKSPACE_PREVIEW_HEIGHT_STORAGE_KEY,
  WORKSPACE_PREVIEW_WIDTH_STORAGE_KEY,
  WORKSPACE_PREVIEW_MIN_HEIGHT,
  WORKSPACE_PREVIEW_MAX_HEIGHT,
  WORKSPACE_PREVIEW_MIN_WIDTH,
  WORKSPACE_PREVIEW_MAX_WIDTH,
} from "./workspacePreviewConstants";

const SIDEBAR_MIN = 260;
const SIDEBAR_MAX = 620;
const WORKSPACE_PANEL_MIN = 340;
const WORKSPACE_PANEL_MAX = 900;
const MOBILE_BREAKPOINT = 900;
const WORKSPACE_PANEL_BREAKPOINT = 1200;

function persistWorkspacePreviewHeight(height) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(WORKSPACE_PREVIEW_HEIGHT_STORAGE_KEY, String(height));
  } catch {
    // Ignore storage failures; preview sizing should not block runtime behavior.
  }
}

function persistWorkspacePreviewWidth(width) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(WORKSPACE_PREVIEW_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // Ignore storage failures; preview sizing should not block runtime behavior.
  }
}

export default function useAppRuntimeEffects({
  me,
  domains,
  domainRuntime,
  composerRuntime,
}) {
  const { threads, session, ui, approvals } = domains;
  const { refs, threadState, workspace, threadActions, projectThreadTabs } =
    domainRuntime;
  const { palette, commandActions, autoResizeInput } = composerRuntime;
  const turnMutations = useTurnMessageMutations({
    applyMessageMutationForThread: threadState.applyMessageMutationForThread,
    normalizeThreadId,
    formatPlanChecklistText,
    summarizeReasoningStatus,
    reasoningStateRef: refs.reasoningStateRef,
    setActivityDetailForThread: threadState.setActivityDetailForThread,
  });

  useTurnSession({
    me,
    turnNotificationEnabled: ui.turnNotificationEnabled,
    loadProjects: threadActions.loadProjects,
    loadThreads: threadActions.loadThreads,
    loadSkillSuggestions: domainRuntime.loadSkillSuggestions,
    loadSessionSummary: threadActions.loadSessionSummary,
    loadApprovals: approvals.loadApprovals,
    loadWorkspaceStatus: workspace.loadWorkspaceStatus,
    refreshWorkspaceBrowser: workspace.refreshWorkspaceBrowser,
    activeProjectKey: domainRuntime.activeProjectKey,
    activeProjectTabId: threads.activeProjectTabId,
    activeThreadRef: threadState.activeThreadRef,
    activeProjectKeyRef: refs.activeProjectKeyRef,
    activeProjectTabIdRef: refs.activeProjectTabIdRef,
    streamedTurnIdsRef: refs.streamedTurnIdsRef,
    assistantItemCompletedByTurnRef: refs.assistantItemCompletedByTurnRef,
    itemPhaseByTurnRef: refs.itemPhaseByTurnRef,
    turnThreadIdRef: threadState.turnThreadIdRef,
    reasoningStateRef: refs.reasoningStateRef,
    debugLog: domainRuntime.debugLog,
    debugError: domainRuntime.debugError,
    appendMessageToThread: threadState.appendMessageToThread,
    applyMessageMutationForThread: threadState.applyMessageMutationForThread,
    appendReasoningStatus: turnMutations.appendReasoningStatus,
    completeReasoning: turnMutations.completeReasoning,
    upsertPlanMessage: turnMutations.upsertPlanMessage,
    upsertPlanChecklist: turnMutations.upsertPlanChecklist,
    setStatusForThread: threadState.setStatusForThread,
    setActivityDetailForThread: threadState.setActivityDetailForThread,
    setMessages: threadState.setMessages,
    updateThreadTabState: projectThreadTabs.updateThreadTabState,
    playTurnNotification: domainRuntime.playTurnNotification,
    setApprovalBusyId: approvals.setApprovalBusyId,
    setApprovalItems: approvals.setApprovalItems,
    setCollaborationMode: session.setCollaborationMode,
    normalizeCollaborationMode,
    resolveThreadIdFromTurn: threadState.resolveThreadIdFromTurn,
  });
  useChatScrollEffects({
    messages: threadState.messages,
    renderItems: domainRuntime.renderItems,
    chatRef: refs.chatRef,
  });
  // Composer focus effects
  useEffect(() => {
    if (threadState.status === "running" || !refs.pendingComposerFocusRef.current) return;
    refs.pendingComposerFocusRef.current = false;
    commandActions.focusComposer(threadState.input.length);
  }, [threadState.input.length, threadState.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    autoResizeInput();
  }, [threadState.input]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!refs.composerFocusWantedRef.current || typeof window === "undefined") return undefined;
    const el = refs.inputRef.current;
    if (!el || el.disabled) return undefined;
    if (document.activeElement === el) {
      commandActions.rememberComposerSelection(el);
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      if (!refs.composerFocusWantedRef.current) return;
      const current = refs.inputRef.current;
      if (!current || current.disabled || document.activeElement === current) return;
      current.focus();
      const { start, end } = refs.composerSelectionRef.current;
      if (typeof start === "number" && typeof end === "number") {
        current.selectionStart = start;
        current.selectionEnd = end;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [threadState.input, palette.paletteOpen, ui.paletteSelectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Palette effects
  useEffect(() => {
    ui.setPaletteSelectedIndex(0);
  }, [palette.activeToken?.type, palette.activeToken?.query]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ui.paletteSelectedIndex < palette.paletteItems.length) return;
    ui.setPaletteSelectedIndex(0);
  }, [palette.paletteItems.length, ui.paletteSelectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!palette.paletteOpen || !refs.paletteRef.current) return;
    const container = refs.paletteRef.current;
    const active = container.querySelector(".slash-item.active");
    if (!active) return;
    active.scrollIntoView({ block: "nearest" });
  }, [palette.paletteOpen, ui.paletteSelectedIndex, palette.visiblePaletteItems.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useThreadBootstrapEffects({
    loadThreads: threadActions.loadThreads,
    activeProjectKey: domainRuntime.activeProjectKey,
    activeProjectTabId: threads.activeProjectTabId,
    resolveCurrentThreadId: threadActions.resolveCurrentThreadId,
    setActiveThreadForProjectTab:
      projectThreadTabs.setActiveThreadForProjectTab,
    restoreWorkspaceForThread: workspace.restoreWorkspaceForThread,
    viewThread: threadActions.viewThread,
    setMessages: threadState.setMessages,
    loadSessionSummary: threadActions.loadSessionSummary,
  });
  useViewportLayout({
    mobileBreakpoint: MOBILE_BREAKPOINT,
    workspacePanelBreakpoint: WORKSPACE_PANEL_BREAKPOINT,
    isMobileLayout: ui.isMobileLayout,
    isSidebarOpen: ui.isSidebarOpen,
    isCompactWorkspaceLayout: ui.isCompactWorkspaceLayout,
    setIsMobileLayout: ui.setIsMobileLayout,
    setIsCompactWorkspaceLayout: ui.setIsCompactWorkspaceLayout,
    setIsSidebarOpen: ui.setIsSidebarOpen,
    setIsResizingSidebar: ui.setIsResizingSidebar,
    setIsWorkspacePanelOpen: ui.setIsWorkspacePanelOpen,
    setIsResizingWorkspacePanel: workspace.setIsResizingWorkspacePanel,
  });
  useResizeInteractions({
    sidebarMin: SIDEBAR_MIN,
    sidebarMax: SIDEBAR_MAX,
    workspacePanelMin: WORKSPACE_PANEL_MIN,
    workspacePanelMax: WORKSPACE_PANEL_MAX,
    workspacePreviewMinWidth: WORKSPACE_PREVIEW_MIN_WIDTH,
    workspacePreviewMaxWidth: WORKSPACE_PREVIEW_MAX_WIDTH,
    workspacePreviewMinHeight: WORKSPACE_PREVIEW_MIN_HEIGHT,
    workspacePreviewMaxHeight: WORKSPACE_PREVIEW_MAX_HEIGHT,
    isResizingSidebar: ui.isResizingSidebar,
    isResizingWorkspacePanel: workspace.isResizingWorkspacePanel,
    isResizingWorkspacePreview: workspace.isResizingWorkspacePreview,
    workspacePreview: workspace.workspacePreview,
    isProjectModeModalOpen: ui.isProjectModeModalOpen,
    shortcutModalPage: ui.shortcutModalPage,
    workspacePreviewWidth: workspace.workspacePreviewWidth,
    workspacePreviewHeight: workspace.workspacePreviewHeight,
    workspaceResizeRef: refs.workspaceResizeRef,
    workspacePreviewResizeRef: refs.workspacePreviewResizeRef,
    setSidebarWidth: ui.setSidebarWidth,
    setIsResizingSidebar: ui.setIsResizingSidebar,
    setWorkspacePanelWidth: workspace.setWorkspacePanelWidth,
    setIsResizingWorkspacePanel: workspace.setIsResizingWorkspacePanel,
    setWorkspacePreviewWidth: workspace.setWorkspacePreviewWidth,
    setWorkspacePreviewHeight: workspace.setWorkspacePreviewHeight,
    setIsResizingWorkspacePreview: workspace.setIsResizingWorkspacePreview,
    setWorkspacePreview: workspace.setWorkspacePreview,
    persistWorkspacePreviewWidth,
    persistWorkspacePreviewHeight,
  });
  useAppUiEffects({
    activeToken: palette.activeToken,
    workspaceContextQuery: workspace.workspaceContextQuery,
    api,
    setProjectSuggestions: threads.setProjectSuggestions,
    floatingAgentSettings: session.floatingAgentSettings,
    activeAgentSettings: session.activeAgentSettings,
    setFloatingAgentSettings: session.setFloatingAgentSettings,
    isProjectModeModalOpen: ui.isProjectModeModalOpen,
    setPendingProjectTarget: ui.setPendingProjectTarget,
    setIsProjectModeModalOpen: ui.setIsProjectModeModalOpen,
    commandRefs: refs.commandRefs,
    sendMessage: commandActions.sendMessage,
    startThread: threadActions.startThread,
    closeThreadTab: threadActions.closeThreadTab,
    viewThread: threadActions.viewThread,
    selectProject: threadActions.selectProject,
    focusComposer: commandActions.focusComposer,
    setInputForActiveThread: threadState.setInputForActiveThread,
  });
  const projectPicker = useProjectPickerViewModel({
    projectItems: threads.projectItems,
    projectSearchQuery: ui.projectSearchQuery,
    setPendingProjectTarget: ui.setPendingProjectTarget,
    setIsProjectModeModalOpen: ui.setIsProjectModeModalOpen,
    setShortcutModalPage: ui.setShortcutModalPage,
    setProjectSearchQuery: ui.setProjectSearchQuery,
    selectProject: threadActions.selectProject,
  });
  useGlobalKeyboardShortcuts({
    shortcutModalPage: ui.shortcutModalPage,
    interactionBusy: domainRuntime.interactionBusy,
    activeThread: threads.activeThread,
    activeProjectTabId: threads.activeProjectTabId,
    threadTabsByProjectTabId: threads.threadTabsByProjectTabId,
    collaborationMode: session.collaborationMode,
    modeSwitchBusy: session.modeSwitchBusy,
    isCompactWorkspaceLayout: ui.isCompactWorkspaceLayout,
    projectSearchQuery: ui.projectSearchQuery,
    filteredProjects: projectPicker.filteredProjects,
    selectedProjectIndex: ui.selectedProjectIndex,
    activeProjectKey: domainRuntime.activeProjectKey,
    commandRefs: refs.commandRefs,
    setShortcutModalPage: ui.setShortcutModalPage,
    setProjectSearchQuery: ui.setProjectSearchQuery,
    setSelectedProjectIndex: ui.setSelectedProjectIndex,
    setIsWorkspacePanelOpen: ui.setIsWorkspacePanelOpen,
    setCollaborationMode: session.setCollaborationMode,
    api,
    normalizeThreadId,
  });

  return {
    projectPicker,
  };
}
