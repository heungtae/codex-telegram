import React from "react";
import ApprovalStack from "../../approvals/components/ApprovalStack";
import ChatMessageFeed from "../../chat/components/ChatMessageFeed";
import { normalizeThreadId } from "../../common/utils";
import AppCenterPanePresenter from "./AppCenterPanePresenter";
import AppComposerPresenter from "./AppComposerPresenter";
import ChatHeader from "./ChatHeader";
import OpenInTelegramModal from "./OpenInTelegramModal";
import WorkspacePreviewOverlay from "./WorkspacePreviewOverlay";

export default function AppConversationPane({ tabs, workspace, conversation, composer, icons }) {
  const {
    threadItems,
    threadTabs,
    activeThread,
    telegramActiveThreadId,
    onAddThread,
    disableAddThread,
    onOpenThreadInTelegram,
  } = tabs;
  const activeThreadTab = threadTabs.find(
    (tab) => normalizeThreadId(tab.id) === normalizeThreadId(activeThread)
  );
  const telegramActiveThread = threadItems.find(
    (item) => normalizeThreadId(item.id) === normalizeThreadId(telegramActiveThreadId)
  );
  const {
    workspacePreview,
    isResizingWorkspacePreview,
    isMobileLayout,
    workspacePreviewWidth,
    workspacePreviewHeight,
    workspacePreviewResizeRef,
    setIsResizingWorkspacePreview,
    setWorkspacePreview,
    resetWorkspacePreviewSize,
    workspacePanel,
  } = workspace;
  const { chatRef, approvalItems, approvalBusyId, onSubmitApproval, onCloseApprovals, renderItems } = conversation;
  const {
    activityDetail,
    paletteOpen,
    paletteRef,
    visiblePaletteItems,
    paletteWindowStart,
    paletteSelectedIndex,
    activeTokenType,
    onApplyPaletteItem,
    collaborationMode,
    composerLocked,
    modeSwitchBusy,
    onToggleComposerMode,
    inputRef,
    input,
    onInputChange,
    onInputFocus,
    onInputBlur,
    onInputSelect,
    onInputKeyDown,
    status,
    onInterrupt,
    onSendMessage,
    isCompactWorkspaceLayout,
    isWorkspacePanelOpen,
    onToggleWorkspacePanel,
    onNewChat,
    interactionBusy,
  } = composer;
  const { StopIcon, SendIcon, FolderIcon, NewChatIcon } = icons;
  const [isOpenInTelegramModalOpen, setIsOpenInTelegramModalOpen] = React.useState(false);
  const [selectedTelegramThreadId, setSelectedTelegramThreadId] = React.useState("");
  const [openInTelegramBusy, setOpenInTelegramBusy] = React.useState(false);
  const [openInTelegramError, setOpenInTelegramError] = React.useState("");

  const openInTelegramModal = () => {
    const initialThreadId =
      normalizeThreadId(activeThreadTab?.id || activeThread) ||
      normalizeThreadId(telegramActiveThreadId) ||
      normalizeThreadId(threadItems[0]?.id) ||
      "";
    setSelectedTelegramThreadId(initialThreadId);
    setOpenInTelegramError("");
    setIsOpenInTelegramModalOpen(true);
  };

  const handleOpenInTelegramContextMenu = (event) => {
    event.preventDefault();
    openInTelegramModal();
  };

  const handleOpenInTelegramConfirm = async () => {
    const normalizedSelectedThreadId = normalizeThreadId(selectedTelegramThreadId);
    if (!normalizedSelectedThreadId || openInTelegramBusy) {
      return;
    }
    setOpenInTelegramBusy(true);
    setOpenInTelegramError("");
    try {
      await onOpenThreadInTelegram(normalizedSelectedThreadId);
      setIsOpenInTelegramModalOpen(false);
    } catch (err) {
      setOpenInTelegramError(err instanceof Error ? err.message : "Failed to open thread in Telegram.");
    } finally {
      setOpenInTelegramBusy(false);
    }
  };

  return (
    <>
      <OpenInTelegramModal
        isOpen={isOpenInTelegramModalOpen}
        onClose={() => {
          setIsOpenInTelegramModalOpen(false);
          setOpenInTelegramError("");
        }}
        threadItems={threadItems}
        selectedThreadId={selectedTelegramThreadId}
        onSelectThread={setSelectedTelegramThreadId}
        onConfirm={handleOpenInTelegramConfirm}
        currentTelegramThreadId={telegramActiveThreadId}
        currentTelegramThreadTitle={telegramActiveThread?.title || telegramActiveThread?.id || ""}
        loading={openInTelegramBusy}
        errorMessage={openInTelegramError}
      />
      <AppCenterPanePresenter
        topTabs={
          <ChatHeader
            activeThreadTitle={activeThreadTab?.title || activeThreadTab?.id || activeThread}
            onAddThread={onAddThread}
            disableAddThread={disableAddThread}
            onContextMenu={handleOpenInTelegramContextMenu}
          />
        }
        centerPane={
          <>
            {isCompactWorkspaceLayout ? (
              <WorkspacePreviewOverlay
                workspacePreview={workspacePreview}
                isResizingWorkspacePreview={isResizingWorkspacePreview}
                isMobileLayout={isMobileLayout}
                workspacePreviewWidth={workspacePreviewWidth}
                workspacePreviewHeight={workspacePreviewHeight}
                workspacePreviewResizeRef={workspacePreviewResizeRef}
                setIsResizingWorkspacePreview={setIsResizingWorkspacePreview}
                setWorkspacePreview={setWorkspacePreview}
                resetWorkspacePreviewSize={resetWorkspacePreviewSize}
              />
            ) : null}
            <div className="chat" ref={chatRef}>
              <ApprovalStack
                approvalItems={approvalItems}
                approvalBusyId={approvalBusyId}
                onSubmitApproval={onSubmitApproval}
                onClose={onCloseApprovals}
              />
              <ChatMessageFeed renderItems={renderItems} />
            </div>
            <AppComposerPresenter
              activityDetail={activityDetail}
              paletteOpen={paletteOpen}
              paletteRef={paletteRef}
              visiblePaletteItems={visiblePaletteItems}
              paletteWindowStart={paletteWindowStart}
              paletteSelectedIndex={paletteSelectedIndex}
              activeTokenType={activeTokenType}
              onApplyPaletteItem={onApplyPaletteItem}
              collaborationMode={collaborationMode}
              composerLocked={composerLocked}
              modeSwitchBusy={modeSwitchBusy}
              onToggleComposerMode={onToggleComposerMode}
              inputRef={inputRef}
              input={input}
              onInputChange={onInputChange}
              onInputFocus={onInputFocus}
              onInputBlur={onInputBlur}
              onInputSelect={onInputSelect}
              onInputKeyDown={onInputKeyDown}
              status={status}
              onInterrupt={onInterrupt}
              onSendMessage={onSendMessage}
              isCompactWorkspaceLayout={isCompactWorkspaceLayout}
              isWorkspacePanelOpen={isWorkspacePanelOpen}
              onToggleWorkspacePanel={onToggleWorkspacePanel}
              onNewChat={onNewChat}
              interactionBusy={interactionBusy}
              StopIcon={StopIcon}
              SendIcon={SendIcon}
              FolderIcon={FolderIcon}
              NewChatIcon={NewChatIcon}
            />
          </>
        }
        isCompactWorkspaceLayout={isCompactWorkspaceLayout}
        isWorkspacePanelOpen={isWorkspacePanelOpen}
        workspacePanel={workspacePanel}
      />
    </>
  );
}
