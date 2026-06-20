import { IconButton } from "../../common/components/ui";
import { NewChatIcon } from "../../common/components/Icons";

export default function ChatHeader({
  activeThreadTitle,
  onAddThread,
  disableAddThread,
  onContextMenu,
}) {
  return (
    <header
      className="chat-header"
      title="Right-click to open in Telegram"
      onContextMenu={onContextMenu}
    >
      <h2 className="chat-header-title">
        {activeThreadTitle || "New thread"}
      </h2>
      <IconButton
        className="chat-header-add"
        onClick={onAddThread}
        ariaLabel="Add thread tab"
        title="Add thread tab"
        disabled={disableAddThread}
      >
        <NewChatIcon />
      </IconButton>
    </header>
  );
}
