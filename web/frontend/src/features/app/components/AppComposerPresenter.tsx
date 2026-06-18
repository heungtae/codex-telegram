import { IconButton, Textarea } from "../../common/components/ui";

export default function AppComposerPresenter({
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
  StopIcon,
  SendIcon,
  FolderIcon,
  NewChatIcon,
}) {
  return (
    <div className="composer">
      {activityDetail ? <div className="activity-indicator composer-activity-indicator">{activityDetail}</div> : null}
      <div className="composer-inner">
        <div className="input-wrap">
          {paletteOpen ? (
            <div className="slash-panel" ref={paletteRef}>
              {visiblePaletteItems.map((item, idx) => {
                const absoluteIndex = paletteWindowStart + idx;
                return (
                  <button
                    key={`${activeTokenType || "t"}:${item}`}
                    className={`slash-item ${absoluteIndex === paletteSelectedIndex ? "active" : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onApplyPaletteItem(item);
                    }}
                  >
                    {activeTokenType === "project" ? "@" : activeTokenType === "skill" ? "$" : ""}
                    {item}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="composer-input-shell">
            <Textarea
              ref={inputRef}
              className="composer-input"
              rows={1}
              value={input}
              disabled={composerLocked}
              onChange={onInputChange}
              onFocus={onInputFocus}
              onBlur={onInputBlur}
              onSelect={onInputSelect}
              onKeyDown={onInputKeyDown}
              placeholder="Message..."
            />
          </div>
        </div>
        <div className="composer-bottom-bar">
          <div className="composer-left-group">
            <IconButton
              className="composer-action composer-new-chat"
              onClick={onNewChat}
              ariaLabel="New chat"
              title="New chat"
              disabled={interactionBusy}
            >
              <NewChatIcon />
            </IconButton>
            {collaborationMode === "plan" ? (
              <button
                type="button"
                className="composer-plan-chip"
                disabled={composerLocked || modeSwitchBusy}
                onClick={onToggleComposerMode}
                title="Plan mode active. Click to toggle."
                aria-label="Plan mode active. Click to toggle."
              >
                PLAN
              </button>
            ) : null}
            {isCompactWorkspaceLayout ? (
              <IconButton
                className={`composer-action composer-workspace-toggle ${isWorkspacePanelOpen ? "active" : ""}`}
                onClick={onToggleWorkspacePanel}
                ariaLabel="Workspace files"
                title="Workspace files"
                active={isWorkspacePanelOpen}
              >
                <FolderIcon open={isWorkspacePanelOpen} />
              </IconButton>
            ) : null}
          </div>
          <div className="composer-right-group">
            {status === "running" ? (
              <IconButton className="composer-action composer-stop" onClick={onInterrupt} ariaLabel="Stop" title="Stop">
                <StopIcon />
              </IconButton>
            ) : (
              <IconButton className="composer-action composer-send" onClick={onSendMessage} ariaLabel="Send" title="Send">
                <SendIcon />
              </IconButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
