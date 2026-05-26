import { normalizeThreadId } from "../../common/utils";

export default function useComposerInputHandlers({
  composerLocked,
  input,
  inputRef,
  activeThread,
  messagesByThreadId,
  composerFocusWantedRef,
  recentBackspaceAtRef,
  inputHistoryIndexRef,
  rememberComposerSelection,
  paletteOpen,
  paletteItems,
  paletteSelectedIndex,
  setPaletteSelectedIndex,
  setInputForActiveThread,
  applyPaletteItem,
  toggleComposerMode,
  sendMessage,
}) {
  const onInputChange = (e) => {
    composerFocusWantedRef.current = true;
    rememberComposerSelection(e.currentTarget);
    inputHistoryIndexRef.current = -1;
    setInputForActiveThread(e.target.value);
  };

  const onInputFocus = (e) => {
    composerFocusWantedRef.current = true;
    rememberComposerSelection(e.currentTarget);
  };

  const onInputBlur = (e) => {
    const now =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    if (now - recentBackspaceAtRef.current <= 250) {
      composerFocusWantedRef.current = true;
      return;
    }
    composerFocusWantedRef.current = false;
    rememberComposerSelection(e.currentTarget);
  };

  const onInputSelect = (e) => {
    rememberComposerSelection(e.currentTarget);
  };

  const onInputKeyDown = (e) => {
    if (composerLocked) {
      return;
    }
    if (e.nativeEvent.isComposing) {
      return;
    }
    composerFocusWantedRef.current = true;
    rememberComposerSelection(e.currentTarget);
    if (e.key === "Backspace") {
      recentBackspaceAtRef.current =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
    }
    if (e.key === "Tab" && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      toggleComposerMode().catch(() => {});
      return;
    }
    if (paletteOpen && e.key === "ArrowDown") {
      e.preventDefault();
      setPaletteSelectedIndex((prev) => (prev + 1) % paletteItems.length);
      return;
    }
    if (paletteOpen && e.key === "ArrowUp") {
      e.preventDefault();
      setPaletteSelectedIndex((prev) => (prev - 1 + paletteItems.length) % paletteItems.length);
      return;
    }
    if (!paletteOpen && e.key === "ArrowUp") {
      e.preventDefault();
      const activeThreadId = normalizeThreadId(activeThread);
      const threadMessages = messagesByThreadId[activeThreadId] || [];
      const userMessages = threadMessages
        .filter((m) => m?.role === "user" && typeof m?.text === "string" && m.text.trim())
        .map((m) => m.text);
      if (userMessages.length === 0) {
        return;
      }
      const newIndex = Math.min(inputHistoryIndexRef.current + 1, userMessages.length - 1);
      inputHistoryIndexRef.current = newIndex;
      setInputForActiveThread(userMessages[userMessages.length - 1 - newIndex]);
      return;
    }
    if (!paletteOpen && e.key === "ArrowDown") {
      e.preventDefault();
      if (inputHistoryIndexRef.current <= 0) {
        inputHistoryIndexRef.current = -1;
        setInputForActiveThread("");
        return;
      }
      const activeThreadId = normalizeThreadId(activeThread);
      const threadMessages = messagesByThreadId[activeThreadId] || [];
      const userMessages = threadMessages
        .filter((m) => m?.role === "user" && typeof m?.text === "string" && m.text.trim())
        .map((m) => m.text);
      if (userMessages.length === 0) {
        return;
      }
      const newIndex = inputHistoryIndexRef.current - 1;
      inputHistoryIndexRef.current = newIndex;
      setInputForActiveThread(userMessages[userMessages.length - 1 - newIndex]);
      return;
    }
    if (paletteOpen && e.key === "Escape") {
      e.preventDefault();
      return;
    }
    if (e.key !== "Enter") {
      return;
    }
    if (e.altKey || e.shiftKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart ?? input.length;
      const end = el.selectionEnd ?? input.length;
      const next = `${input.slice(0, start)}\n${input.slice(end)}`;
      setInputForActiveThread(next);
      queueMicrotask(() => {
        const pos = start + 1;
        if (inputRef.current) {
          inputRef.current.selectionStart = pos;
          inputRef.current.selectionEnd = pos;
        }
      });
      return;
    }
    if (paletteOpen) {
      e.preventDefault();
      applyPaletteItem(paletteItems[paletteSelectedIndex]);
      return;
    }
    e.preventDefault();
    sendMessage().catch(() => {});
  };

  return { onInputChange, onInputFocus, onInputBlur, onInputSelect, onInputKeyDown };
}
