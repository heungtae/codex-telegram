export default function ChatHeader({
  activeThreadTitle,
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
    </header>
  );
}
