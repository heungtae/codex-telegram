import { Badge, Button, EmptyState, Modal } from "../../common/components/ui";

function normalizeThreadId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function threadTitle(thread) {
  const title = typeof thread?.title === "string" ? thread.title.trim() : "";
  return title || normalizeThreadId(thread?.id) || "Untitled thread";
}

export default function OpenInTelegramModal({
  isOpen,
  onClose,
  threadItems,
  selectedThreadId,
  onSelectThread,
  onConfirm,
  currentTelegramThreadId,
  currentTelegramThreadTitle,
  loading = false,
  errorMessage = "",
}) {
  const normalizedCurrentThreadId = normalizeThreadId(currentTelegramThreadId);
  const currentThreadLabel = currentTelegramThreadTitle || normalizedCurrentThreadId || "none";

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Open in Telegram" className="open-in-telegram-modal">
      <div className="modal-title">Open in Telegram</div>
      <div className="modal-desc">
        Choose which thread Telegram should use for messages.
      </div>
      <div className="open-in-telegram-current">
        <span className="open-in-telegram-current-label">Active in Telegram:</span>
        <span className="open-in-telegram-current-value">{currentThreadLabel}</span>
      </div>
      <div className="open-in-telegram-list" role="list" aria-label="Available threads">
        {threadItems.length === 0 ? (
          <EmptyState className="open-in-telegram-empty">No threads available in this project.</EmptyState>
        ) : (
          threadItems.map((thread) => {
            const threadId = normalizeThreadId(thread?.id);
            const title = threadTitle(thread);
            const isSelected = threadId === normalizeThreadId(selectedThreadId);
            const isCurrentTelegramThread = threadId === normalizedCurrentThreadId;
            return (
              <button
                key={threadId}
                type="button"
                className={`open-in-telegram-item${isSelected ? " selected" : ""}${isCurrentTelegramThread ? " current" : ""}`}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={() => onSelectThread(threadId)}
              >
                <span className="open-in-telegram-item-main">
                  <span className="open-in-telegram-item-title">{title}</span>
                  {isCurrentTelegramThread ? <Badge variant="accent">current</Badge> : null}
                </span>
                <span className="open-in-telegram-item-id">{threadId}</span>
              </button>
            );
          })
        )}
      </div>
      {errorMessage ? <div className="open-in-telegram-error">{errorMessage}</div> : null}
      <div className="modal-actions open-in-telegram-actions">
        <Button
          type="button"
          variant="primary"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={onConfirm}
          disabled={loading || !normalizeThreadId(selectedThreadId)}
        >
          {loading ? "Opening..." : "Open in Telegram"}
        </Button>
        <Button type="button" variant="ghost" onMouseDown={(event) => event.stopPropagation()} onClick={onClose} disabled={loading}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
