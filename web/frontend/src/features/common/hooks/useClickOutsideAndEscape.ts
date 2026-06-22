import { useEffect, useRef, type RefObject } from "react";

export function useClickOutsideAndEscape(
  ref: RefObject<HTMLElement>,
  onClose: () => void,
  enabled: boolean,
  excludeRef?: RefObject<HTMLElement>,
  onEscape?: () => void,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!enabled) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || excludeRef?.current?.contains(target)) return;
      onCloseRef.current();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      (onEscapeRef.current ?? onCloseRef.current)();
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, ref, excludeRef]);
}
