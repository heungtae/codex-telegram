import { useCallback } from "react";
import { normalizeWorkspacePath } from "../../common/utils";

export default function useClipboard(showToast: (msg: string, tone: string) => void) {
  return useCallback(
    async (path: string) => {
      const text = normalizeWorkspacePath(path);
      if (!text) {
        return;
      }
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.setAttribute("readonly", "true");
          textarea.style.position = "fixed";
          textarea.style.left = "-9999px";
          textarea.style.top = "-9999px";
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }
        showToast(`Copied ${text}`, "success");
      } catch {
        showToast("Failed to copy path.", "error");
      }
    },
    [showToast]
  );
}
