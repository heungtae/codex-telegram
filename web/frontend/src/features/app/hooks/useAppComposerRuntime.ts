import { useMemo } from "react";

import { api } from "../../common/api";
import {
  FolderIcon,
  NewChatIcon,
  SendIcon,
  StopIcon,
} from "../../common/components/Icons";
import { normalizeThreadId } from "../../common/utils";
import useComposerInputHandlers from "./useComposerInputHandlers";
import useComposerPalette from "./useComposerPalette";
import { createComposerViewModel } from "./useComposerViewModel";
import useMessageCommandActions from "./useMessageCommandActions";
import { normalizeCollaborationMode } from "./useAppDomainRuntime";

const PALETTE_LIMIT = 10;

export default function useAppComposerRuntime({ domains, domainRuntime }) {
  const { threads, session, ui } = domains;
  const { refs, threadState, activeProjectKey, interactionBusy } = domainRuntime;
  const slashCommands = useMemo(
    () => [
      "/commands",
      "/start",
      "/resume",
      "/fork",
      "/threads",
      "/read",
      "/archive",
      "/unarchive",
      "/compact",
      "/rollback",
      "/interrupt",
      "/review",
      "/exec",
      "/projects",
      "/project",
      "/models",
      "/collab",
      "/features",
      "/modes",
      "/mode",
      "/plan",
      "/build",
      "/skills",
      "/apps",
      "/mcp",
      "/config",
    ],
    []
  );
  const palette = useComposerPalette({
    input: threadState.input,
    slashCommands,
    projectSuggestions: threads.projectSuggestions,
    skillSuggestions: threads.skillSuggestions,
    paletteSelectedIndex: ui.paletteSelectedIndex,
    setPaletteSelectedIndex: ui.setPaletteSelectedIndex,
    paletteLimit: PALETTE_LIMIT,
  });
  const commandActions = useMessageCommandActions({
    api,
    input: threadState.input,
    inputRef: refs.inputRef,
    turnThreadIdRef: threadState.turnThreadIdRef,
    activeThread: threads.activeThread,
    activeProjectKey,
    activeProjectTabId: threads.activeProjectTabId,
    threadItems: threads.threadItems,
    status: threadState.status,
    modeSwitchBusy: session.modeSwitchBusy,
    normalizeThreadId,
    normalizeCollaborationMode,
    resolveCurrentThreadId: domainRuntime.threadActions.resolveCurrentThreadId,
    openThreadInProjectTab: domainRuntime.projectThreadTabs.openThreadInProjectTab,
    setActiveThreadForProjectTab:
      domainRuntime.projectThreadTabs.setActiveThreadForProjectTab,
    setInputForActiveThread: threadState.setInputForActiveThread,
    setMessages: threadState.setMessages,
    setModeSwitchBusy: session.setModeSwitchBusy,
    setCollaborationMode: session.setCollaborationMode,
    setStatusForThread: threadState.setStatusForThread,
    updateThreadUi: threadState.updateThreadUi,
    appendMessageToThread: threadState.appendMessageToThread,
    runCommand: domainRuntime.threadActions.runCommand,
    loadSessionSummary: domainRuntime.threadActions.loadSessionSummary,
    pendingComposerFocusRef: refs.pendingComposerFocusRef,
    composerSelectionRef: refs.composerSelectionRef,
  });
  const autoResizeInput = () => {
    const element = refs.inputRef.current;
    if (!element) {
      return;
    }
    element.style.height = "0px";
    const next = Math.min(element.scrollHeight, 240);
    element.style.height = `${Math.max(40, next)}px`;
  };
  const applyPaletteItem = (item) => {
    commandActions.applyPaletteItem(
      item,
      palette.activeToken,
      threadState.input
    );
  };
  const inputHandlers = useComposerInputHandlers({
    composerLocked: interactionBusy,
    input: threadState.input,
    inputRef: refs.inputRef,
    activeThread: threads.activeThread,
    messagesByThreadId: threadState.messagesByThreadId,
    composerFocusWantedRef: refs.composerFocusWantedRef,
    recentBackspaceAtRef: refs.recentBackspaceAtRef,
    inputHistoryIndexRef: refs.inputHistoryIndexRef,
    rememberComposerSelection: commandActions.rememberComposerSelection,
    paletteOpen: palette.paletteOpen,
    paletteItems: palette.paletteItems,
    paletteSelectedIndex: ui.paletteSelectedIndex,
    setPaletteSelectedIndex: ui.setPaletteSelectedIndex,
    setInputForActiveThread: threadState.setInputForActiveThread,
    applyPaletteItem,
    toggleComposerMode: commandActions.toggleComposerMode,
    sendMessage: commandActions.sendMessage,
  });
  const interrupt = async () => {
    const activeThreadId = normalizeThreadId(threads.activeThread);
    refs.interruptedThreadIdRef.current = activeThreadId;
    await commandActions.interrupt();
    domainRuntime.playTurnNotification(activeThreadId, "cancelled");
  };
  const composerViewModel = createComposerViewModel({
    activeToken: palette.activeToken,
    activityDetail: threadState.activityDetail,
    paletteOpen: palette.paletteOpen,
    paletteRef: refs.paletteRef,
    visiblePaletteItems: palette.visiblePaletteItems,
    paletteWindowStart: palette.paletteWindowStart,
    paletteSelectedIndex: ui.paletteSelectedIndex,
    applyPaletteItem,
    collaborationMode: session.collaborationMode,
    composerLocked: interactionBusy,
    modeSwitchBusy: session.modeSwitchBusy,
    toggleComposerMode: commandActions.toggleComposerMode,
    focusComposer: commandActions.focusComposer,
    inputRef: refs.inputRef,
    input: threadState.input,
    ...inputHandlers,
    status: threadState.status,
    interrupt,
    sendMessage: commandActions.sendMessage,
    isCompactWorkspaceLayout: ui.isCompactWorkspaceLayout,
    isWorkspacePanelOpen: ui.isWorkspacePanelOpen,
    setIsWorkspacePanelOpen: ui.setIsWorkspacePanelOpen,
    startThread: domainRuntime.threadActions.startThread,
    interactionBusy,
    StopIcon,
    SendIcon,
    FolderIcon,
    NewChatIcon,
  });

  return {
    palette,
    commandActions,
    inputHandlers,
    autoResizeInput,
    applyPaletteItem,
    composerViewModel,
  };
}
