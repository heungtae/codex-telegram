import { type MouseEvent, useState } from "react";
import { normalizeThreadId } from "../../common/utils";
import { shouldOpenInTelegramModal } from "../components/openInTelegramState";

export default function useOpenInTelegram(
  activeThreadTab: { id?: string; title?: string } | undefined,
  activeThread: string,
  telegramActiveThreadId: string,
  onOpenThreadInTelegram: (threadId: string) => Promise<void>
) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetThread, setTargetThread] = useState({ id: "", title: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const openModal = () => {
    const targetThreadId = normalizeThreadId(activeThreadTab?.id || activeThread);
    if (!shouldOpenInTelegramModal(targetThreadId, telegramActiveThreadId)) {
      return;
    }
    setTargetThread({
      id: targetThreadId,
      title: activeThreadTab?.title || targetThreadId,
    });
    setError("");
    setIsModalOpen(true);
  };

  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    openModal();
  };

  const handleConfirm = async () => {
    const targetThreadId = normalizeThreadId(targetThread.id);
    if (!targetThreadId || busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onOpenThreadInTelegram(targetThreadId);
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open thread in Telegram.");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setError("");
  };

  return { isModalOpen, targetThread, busy, error, handleContextMenu, handleConfirm, handleClose };
}
