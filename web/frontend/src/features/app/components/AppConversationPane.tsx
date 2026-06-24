import ApprovalStack from "../../approvals/components/ApprovalStack";
import ChatMessageFeed from "../../chat/components/ChatMessageFeed";
import { normalizeThreadId } from "../../common/utils";
import AppComposerPresenter from "./AppComposerPresenter";
import ChatHeader from "./ChatHeader";
import OpenInTelegramModal from "./OpenInTelegramModal";
import WorkspacePreviewOverlay from "./WorkspacePreviewOverlay";

export default function AppConversationPane({ tabs, workspace, conversation, composer, telegramModal }) {
  const {
    threadItems,
    threadTabs,
    activeThread,
    telegramActiveThreadId,
    onAddThread,
    disableAddThread,
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
    workspacePanel,
  } = workspace;
  const { chatRef, approvalItems, approvalBusyId, onSubmitApproval, onCloseApprovals, renderItems } = conversation;
  const { isCompactWorkspaceLayout, isWorkspacePanelOpen } = composer;
  const {
    isModalOpen: isOpenInTelegramModalOpen,
    targetThread: targetTelegramThread,
    busy: openInTelegramBusy,
    error: openInTelegramError,
    handleContextMenu: handleOpenInTelegramContextMenu,
    handleConfirm: handleOpenInTelegramConfirm,
    handleClose: handleOpenInTelegramClose,
  } = telegramModal;

  return (
    <>
      <OpenInTelegramModal
        isOpen={isOpenInTelegramModalOpen}
        onClose={handleOpenInTelegramClose}
        onConfirm={handleOpenInTelegramConfirm}
        targetThreadId={targetTelegramThread.id}
        targetThreadTitle={targetTelegramThread.title}
        currentTelegramThreadId={telegramActiveThreadId}
        currentTelegramThreadTitle={telegramActiveThread?.title || telegramActiveThread?.id || ""}
        loading={openInTelegramBusy}
        errorMessage={openInTelegramError}
      />
      <ChatHeader
        activeThreadTitle={activeThreadTab?.title || activeThreadTab?.id || activeThread}
        onContextMenu={handleOpenInTelegramContextMenu}
      />
      <div className="workspace-layout">
        <div className="center-pane">
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
          <AppComposerPresenter composerViewModel={composer} />
          {isCompactWorkspaceLayout && isWorkspacePanelOpen ? workspacePanel : null}
        </div>
      </div>
    </>
  );
}
