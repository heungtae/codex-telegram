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
          <div className={`composer-input-shell mode-${collaborationMode}`}>
            <button
              type="button"
              className={`composer-mode mode-${collaborationMode}`}
              disabled={composerLocked || modeSwitchBusy}
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={onToggleComposerMode}
              title="Press Tab to toggle mode"
              aria-label={`Collaboration mode ${collaborationMode}. Press Tab to toggle.`}
            >
              <span className="composer-mode-label">{collaborationMode.toUpperCase()}</span>
              <span className="composer-mode-key">TAB</span>
            </button>
            <textarea
              ref={inputRef}
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
        {status === "running" ? (
          <button className="composer-action composer-stop" onClick={onInterrupt} aria-label="Stop" title="Stop">
            <StopIcon />
          </button>
        ) : (
          <button className="composer-action composer-send" onClick={onSendMessage} aria-label="Send" title="Send">
            <SendIcon />
          </button>
        )}
        {isCompactWorkspaceLayout ? (
          <button
            className={`composer-action composer-workspace-toggle ${isWorkspacePanelOpen ? "active" : ""}`}
            onClick={onToggleWorkspacePanel}
            aria-label="Workspace files"
            title="Workspace files"
            type="button"
          >
            <FolderIcon open={isWorkspacePanelOpen} />
          </button>
        ) : null}
        <button
          className="composer-action composer-new-chat"
          onClick={onNewChat}
          aria-label="New chat"
          title="New chat"
          disabled={interactionBusy}
        >
          <NewChatIcon />
        </button>
      </div>
    </div>
  );
}
