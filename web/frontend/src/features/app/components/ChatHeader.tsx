import { IconButton } from "../../common/components/ui";

export default function ChatHeader({
  activeThreadTitle,
  onAddThread,
  disableAddThread,
  onContextMenu,
}) {
  return (
    <header className="chat-header">
      <h2 className="chat-header-title" title="Right-click to open in Telegram" onContextMenu={onContextMenu}>
        {activeThreadTitle || "New thread"}
      </h2>
      <IconButton
        className="chat-header-add"
        onClick={onAddThread}
        ariaLabel="Add thread tab"
        title="Add thread tab"
        disabled={disableAddThread}
      >
        <img className="tab-action-icon" src="/assets/icons-tab-add.svg" alt="" aria-hidden="true" />
      </IconButton>
    </header>
  );
}
