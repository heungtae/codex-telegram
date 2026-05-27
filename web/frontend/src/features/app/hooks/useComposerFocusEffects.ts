/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect } from "react";

export default function useComposerFocusEffects({
  status,
  pendingComposerFocusRef,
  focusComposer,
  input,
  autoResizeInput,
  composerFocusWantedRef,
  inputRef,
  rememberComposerSelection,
  composerSelectionRef,
  paletteOpen,
  paletteSelectedIndex,
}) {
  useEffect(() => {
    if (status === "running" || !pendingComposerFocusRef.current) {
      return;
    }
    pendingComposerFocusRef.current = false;
    focusComposer(input.length);
  }, [input.length, status]);

  useEffect(() => {
    autoResizeInput();
  }, [input]);

  useEffect(() => {
    if (!composerFocusWantedRef.current || typeof window === "undefined") {
      return undefined;
    }
    const el = inputRef.current;
    if (!el || el.disabled) {
      return undefined;
    }
    if (document.activeElement === el) {
      rememberComposerSelection(el);
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      if (!composerFocusWantedRef.current) {
        return;
      }
      const current = inputRef.current;
      if (!current || current.disabled || document.activeElement === current) {
        return;
      }
      current.focus();
      const { start, end } = composerSelectionRef.current;
      if (typeof start === "number" && typeof end === "number") {
        current.selectionStart = start;
        current.selectionEnd = end;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [input, paletteOpen, paletteSelectedIndex]);
}
