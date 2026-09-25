import { Button, Modal } from "../../common/components/ui";

function normalizeThreadId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function threadTitle(value, fallback) {
  const title = typeof value === "string" ? value.trim() : "";
  return title || normalizeThreadId(fallback) || "Untitled thread";
}

function shortThreadId(value) {
  return normalizeThreadId(value).slice(0, 8);
}

export default function OpenInTelegramModal({
  isOpen,
  onClose,
  onConfirm,
  targetThreadId,
  targetThreadTitle,
  currentTelegramThreadId,
  currentTelegramThreadTitle,
  loading = false,
  errorMessage = "",
}) {
  const normalizedCurrentThreadId = normalizeThreadId(currentTelegramThreadId);
  const isChangingConnection = !!normalizedCurrentThreadId;

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Open in Telegram" className="open-in-telegram-modal" title="Open in Telegram">
      <div className="modal-desc">
        {isChangingConnection
          ? "Change the Telegram connection to this thread?"
          : "Connect this thread to Telegram?"}
      </div>
      {isChangingConnection ? (
        <div className="open-in-telegram-existing">
          <span className="open-in-telegram-existing-label">Connected now</span>
          <span className="open-in-telegram-existing-value">
            <span className="open-in-telegram-existing-id">{shortThreadId(normalizedCurrentThreadId)}</span>
            {currentTelegramThreadTitle ? (
              <span className="open-in-telegram-existing-title">
                {threadTitle(currentTelegramThreadTitle, normalizedCurrentThreadId)}
              </span>
            ) : null}
          </span>
        </div>
      ) : null}
      <div className="open-in-telegram-target" title={normalizeThreadId(targetThreadId)}>
        {threadTitle(targetThreadTitle, targetThreadId)}
      </div>
      {errorMessage ? <div className="open-in-telegram-error">{errorMessage}</div> : null}
      <div className="modal-actions open-in-telegram-actions">
        <Button
          type="button"
          variant="primary"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={onConfirm}
          disabled={loading || !normalizeThreadId(targetThreadId)}
        >
          {loading ? (isChangingConnection ? "Changing..." : "Connecting...") : "Yes"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={onClose}
          disabled={loading}
        >
          No
        </Button>
      </div>
    </Modal>
  );
}
