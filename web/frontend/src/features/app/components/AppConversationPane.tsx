import ApprovalStack from "../../approvals/components/ApprovalStack";
import ChatMessageFeed from "../../chat/components/ChatMessageFeed";
import TopTabs from "../../tabs/components/TopTabs";
import AppCenterPanePresenter from "./AppCenterPanePresenter";
import AppComposerPresenter from "./AppComposerPresenter";
import WorkspacePreviewOverlay from "./WorkspacePreviewOverlay";

export default function AppConversationPane({ tabs, workspace, conversation, composer, icons }) {
  const {
    projectTabs,
    activeProjectTabId,
    projectTabStatusById,
    onSelectProjectTab,
    onCloseProjectTab,
    threadTabs,
    activeThread,
    onSelectThread,
    onCloseThread,
    onAddThread,
    disableAddThread,
  } = tabs;
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
    isResizingWorkspacePanel,
    onStartWorkspacePanelResize,
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

  return (
    <AppCenterPanePresenter
      topTabs={
        <TopTabs
          projectTabs={projectTabs}
          activeProjectTabId={activeProjectTabId}
          projectTabStatusById={projectTabStatusById}
          onSelectProjectTab={onSelectProjectTab}
          onCloseProjectTab={onCloseProjectTab}
          threadTabs={threadTabs}
          activeThread={activeThread}
          onSelectThread={onSelectThread}
          onCloseThread={onCloseThread}
          onAddThread={onAddThread}
          disableAddThread={disableAddThread}
        />
      }
      centerPane={
        <>
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
      isResizingWorkspacePanel={isResizingWorkspacePanel}
      onStartWorkspacePanelResize={onStartWorkspacePanelResize}
    />
  );
}
