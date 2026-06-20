import { normalizeThreadId } from "../../common/utils";

export function shouldOpenInTelegramModal(activeThreadId, telegramThreadId) {
  const normalizedActiveThreadId = normalizeThreadId(activeThreadId);
  return !!normalizedActiveThreadId && normalizedActiveThreadId !== normalizeThreadId(telegramThreadId);
}
