export default function useMessageCommandActions({
  api,
  input,
  inputRef,
  turnThreadIdRef,
  activeThread,
  activeProjectKey,
  activeProjectTabId,
  threadItems,
  status,
  modeSwitchBusy,
  normalizeThreadId,
  normalizeCollaborationMode,
  resolveCurrentThreadId,
  openThreadInProjectTab,
  setActiveThreadForProjectTab,
  setInputForActiveThread,
  setMessages,
  setModeSwitchBusy,
  setCollaborationMode,
  setStatusForThread,
  updateThreadUi,
  appendMessageToThread,
  runCommand,
  loadSessionSummary,
  pendingComposerFocusRef,
  composerSelectionRef,
}) {
  const focusComposer = (cursor = null) => {
    queueMicrotask(() => {
      const el = inputRef.current;
      if (!el || el.disabled) {
        return;
      }
      el.focus();
      if (typeof cursor === "number") {
        el.selectionStart = cursor;
        el.selectionEnd = cursor;
        composerSelectionRef.current = { start: cursor, end: cursor };
      }
    });
  };

  const rememberComposerSelection = (el) => {
    if (!el) {
      return;
    }
    composerSelectionRef.current = {
      start: typeof el.selectionStart === "number" ? el.selectionStart : null,
      end: typeof el.selectionEnd === "number" ? el.selectionEnd : null,
    };
  };

  const toggleComposerMode = async () => {
    if (status === "running" || modeSwitchBusy) {
      return;
    }
    setModeSwitchBusy(true);
    try {
      const result = await api("/api/command", {
        method: "POST",
        body: JSON.stringify({ command_line: "/mode toggle" }),
      });
      const nextMode = normalizeCollaborationMode(result?.meta?.collaboration_mode);
      setCollaborationMode(nextMode);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: err.message || "Failed to switch mode.",
          threadId: normalizeThreadId(activeThread),
          turnId: "",
          streaming: false,
        },
      ]);
    } finally {
      setModeSwitchBusy(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) {
      return;
    }
    const text = input.trim();
    const activeThreadId = resolveCurrentThreadId();
    if (activeThreadId) {
      if (activeThreadId !== normalizeThreadId(activeThread) && activeProjectTabId) {
        setActiveThreadForProjectTab(activeProjectTabId, activeThreadId);
      }
      updateThreadUi(activeThreadId, { input: "" });
    }
    pendingComposerFocusRef.current = true;
    setInputForActiveThread("");
    if (text.startsWith("/")) {
      await runCommand(text);
      return;
    }
    const messageThreadId = activeThreadId;
    appendMessageToThread(messageThreadId, { role: "user", text, turnId: "" });
    setStatusForThread(messageThreadId, "running");
    try {
      const result = await api("/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          text,
          thread_id: messageThreadId || undefined,
          project_key: activeProjectKey || undefined,
        }),
      });
      const resultTurnId = typeof result?.turn_id === "string" ? result.turn_id : "";
      const resultThreadId = normalizeThreadId(result?.thread_id) || messageThreadId;
      if (resultThreadId && activeProjectTabId) {
        const threadInfo = threadItems.find((item) => normalizeThreadId(item?.id) === resultThreadId);
        openThreadInProjectTab(activeProjectTabId, {
          id: resultThreadId,
          title: threadInfo?.title || resultThreadId,
        });
      }
      if (resultTurnId && resultThreadId) {
        turnThreadIdRef.current[resultTurnId] = resultThreadId;
      }
      if (result.local_command) {
        const responseThreadId = resultThreadId;
        appendMessageToThread(responseThreadId, {
          role: "assistant",
          text: result.output || "",
          threadId: responseThreadId,
          turnId: resultTurnId,
        });
        setStatusForThread(responseThreadId, "idle");
        loadSessionSummary().catch(() => {});
      }
    } catch (err) {
      setStatusForThread(messageThreadId, "idle");
      appendMessageToThread(messageThreadId, {
        role: "system",
        text: err.message || "Request failed.",
        threadId: messageThreadId,
        turnId: "",
        streaming: false,
      });
      loadSessionSummary().catch(() => {});
    }
  };

  const interrupt = async () => {
    const activeThreadId = normalizeThreadId(activeThread);
    await api("/api/threads/interrupt", {
      method: "POST",
      body: JSON.stringify({ thread_id: activeThreadId || undefined }),
    });
    setStatusForThread(activeThreadId, "idle");
  };

  const applyPaletteItem = (item, activeToken, currentInput) => {
    if (!activeToken) {
      return;
    }
    let next = currentInput;
    let cursor = currentInput.length;
    if (activeToken.type === "slash") {
      next = `${item} `;
      cursor = next.length;
    } else if (activeToken.type === "project") {
      next = `${currentInput.slice(0, activeToken.start)}@${item}${currentInput.slice(activeToken.end)}`;
      cursor = activeToken.start + item.length + 1;
    } else {
      next = `${currentInput.slice(0, activeToken.start)}$${item}${currentInput.slice(activeToken.end)}`;
      cursor = activeToken.start + item.length + 1;
    }
    setInputForActiveThread(next);
    focusComposer(cursor);
  };

  return {
    sendMessage,
    toggleComposerMode,
    interrupt,
    focusComposer,
    rememberComposerSelection,
    applyPaletteItem,
  };
}
