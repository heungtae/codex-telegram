import { useEffect } from "react";

export default function useChatScrollEffects({
  messages,
  renderItems,
  chatRef,
}) {
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
