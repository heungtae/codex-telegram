/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect } from "react";

export default function useChatScrollEffects({
  normalizeThreadId,
  activeThreadRef,
  messages,
  renderItems,
  debugLog,
  chatRef,
}) {
  useEffect(() => {
    const activeThreadId = normalizeThreadId(activeThreadRef.current);
    const preview = (Array.isArray(messages) ? messages : []).slice(-5).map((m) => ({
      role: m?.role || "",
      threadId: m?.threadId || "",
      turnId: m?.turnId || "",
      itemId: m?.itemId || "",
      kind: m?.kind || "",
      streaming: !!m?.streaming,
      text: typeof m?.text === "string" ? m.text.slice(0, 120) : "",
      visibleInCurrentThread: !m?.threadId || normalizeThreadId(m.threadId) === activeThreadId,
    }));
    debugLog("[CHAT-RENDER]", {
      activeThreadId,
      messageCount: Array.isArray(messages) ? messages.length : 0,
      renderItemCount: Array.isArray(renderItems) ? renderItems.length : 0,
      tailMessages: preview,
    });
  }, [messages, renderItems, activeThreadRef]);

  useEffect(() => {
    if (!chatRef.current) {
      return;
    }
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!chatRef.current) {
      return;
    }
    const panels = chatRef.current.querySelectorAll(".file-change-panel-scroll");
    panels.forEach((panel) => {
      panel.scrollTop = panel.scrollHeight;
    });
  }, [renderItems]);
}
