import { useEffect, useRef, useState } from "react";

import { createEmptyThreadUiState, normalizeThreadId } from "../../common/utils";

export default function useThreadScopedState(activeThread) {
  const debugLog = (...args) => {
    if (typeof window !== "undefined" && window.__CODEX_WEB_DEBUG__ === true) {
      console.log(...args);
    }
  };
  const [messages, setMessages] = useState([]);
  const [messagesByThreadId, setMessagesByThreadId] = useState({});
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("idle");
  const [activityDetail, setActivityDetail] = useState("");
  const [threadUiByThreadId, setThreadUiByThreadId] = useState({});
  const messagesByThreadIdRef = useRef({});
  const threadUiByThreadIdRef = useRef({});
  const activeThreadRef = useRef("");
  const turnThreadIdRef = useRef({});

  useEffect(() => {
    messagesByThreadIdRef.current = messagesByThreadId;
  }, [messagesByThreadId]);

  useEffect(() => {
    threadUiByThreadIdRef.current = threadUiByThreadId;
  }, [threadUiByThreadId]);

  useEffect(() => {
    activeThreadRef.current = normalizeThreadId(activeThread);
  }, [activeThread]);

  useEffect(() => {
    const threadId = normalizeThreadId(activeThread);
    if (!threadId) {
      return;
    }
    setMessagesByThreadId((prev) => {
      if (prev[threadId] === messages) {
        return prev;
      }
      return { ...prev, [threadId]: messages };
    });
  }, [activeThread, messages]);

  useEffect(() => {
    const threadId = normalizeThreadId(activeThread);
    if (!threadId) {
      setInput("");
      setStatus("idle");
      setActivityDetail("");
      return;
    }
    const saved = threadUiByThreadIdRef.current[threadId] || createEmptyThreadUiState();
    setInput(typeof saved.input === "string" ? saved.input : "");
    setStatus(typeof saved.status === "string" ? saved.status : "idle");
    setActivityDetail(typeof saved.activityDetail === "string" ? saved.activityDetail : "");
  }, [activeThread]);

  const restoreThreadMessages = (threadId) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    if (!normalizedThreadId) {
      setMessages([]);
      return false;
    }
    const cached = messagesByThreadIdRef.current[normalizedThreadId];
    if (Array.isArray(cached)) {
      setMessages(cached);
      return true;
    }
    setMessages([]);
    return false;
  };

  const appendMessageToThread = (threadId, message) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    const activeThreadId = normalizeThreadId(activeThreadRef.current);
    debugLog("[CHAT-MEMORY][append]", {
      activeThreadId,
      targetThreadId: normalizedThreadId || "",
      role: message?.role || "",
      turnId: message?.turnId || "",
      itemId: message?.itemId || "",
      kind: message?.kind || "",
      streaming: !!message?.streaming,
      text: typeof message?.text === "string" ? message.text.slice(0, 200) : "",
    });
    if (!normalizedThreadId) {
      setMessages((prev) => {
        const next = [...prev, message];
        debugLog("[CHAT-MEMORY][append->messages]", {
          activeThreadId,
          targetThreadId: "",
          nextCount: next.length,
        });
        return next;
      });
      return;
    }
    if (normalizedThreadId === activeThreadId) {
      setMessages((prev) => {
        const next = [...prev, message];
        debugLog("[CHAT-MEMORY][append->messages]", {
          activeThreadId,
          targetThreadId: normalizedThreadId,
          nextCount: next.length,
        });
        return next;
      });
      return;
    }
    setMessagesByThreadId((prev) => {
      const existing = Array.isArray(prev[normalizedThreadId]) ? prev[normalizedThreadId] : [];
      const nextThreadMessages = [...existing, message];
      debugLog("[CHAT-MEMORY][append->messagesByThreadId]", {
        activeThreadId,
        targetThreadId: normalizedThreadId,
        nextCount: nextThreadMessages.length,
      });
      return { ...prev, [normalizedThreadId]: nextThreadMessages };
    });
  };

  const applyMessageMutationForThread = (threadId, mutateFn) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    const activeThreadId = normalizeThreadId(activeThreadRef.current);
    debugLog("[CHAT-MEMORY][mutate]", {
      activeThreadId,
      targetThreadId: normalizedThreadId || "",
      targetIsActive: !normalizedThreadId || normalizedThreadId === activeThreadId,
    });
    if (!normalizedThreadId || normalizedThreadId === activeThreadId) {
      setMessages((prev) => {
        const next = mutateFn(prev);
        debugLog("[CHAT-MEMORY][mutate->messages]", {
          activeThreadId,
          targetThreadId: normalizedThreadId || "",
          prevCount: prev.length,
          nextCount: Array.isArray(next) ? next.length : -1,
        });
        return next;
      });
      return;
    }
    setMessagesByThreadId((prev) => {
      const current = Array.isArray(prev[normalizedThreadId]) ? prev[normalizedThreadId] : [];
      const nextThreadMessages = mutateFn(current);
      debugLog("[CHAT-MEMORY][mutate->messagesByThreadId]", {
        activeThreadId,
        targetThreadId: normalizedThreadId,
        prevCount: current.length,
        nextCount: Array.isArray(nextThreadMessages) ? nextThreadMessages.length : -1,
      });
      return { ...prev, [normalizedThreadId]: nextThreadMessages };
    });
  };

  const updateThreadUi = (threadId, patch) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    if (!normalizedThreadId) {
      return;
    }
    setThreadUiByThreadId((prev) => ({
      ...prev,
      [normalizedThreadId]: {
        ...createEmptyThreadUiState(),
        ...(prev[normalizedThreadId] || {}),
        ...patch,
      },
    }));
  };

  const setInputForActiveThread = (nextInput) => {
    setInput(nextInput);
    const threadId = activeThreadRef.current;
    if (threadId) {
      updateThreadUi(threadId, { input: nextInput });
    }
  };

  const setStatusForActiveThread = (nextStatus) => {
    setStatus(nextStatus);
    const threadId = activeThreadRef.current;
    if (threadId) {
      updateThreadUi(threadId, { status: nextStatus });
    }
  };

  const setActivityDetailForActiveThread = (nextDetail) => {
    setActivityDetail(nextDetail);
    const threadId = activeThreadRef.current;
    if (threadId) {
      updateThreadUi(threadId, { activityDetail: nextDetail });
    }
  };

  const setStatusForThread = (threadId, nextStatus) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    if (normalizedThreadId) {
      updateThreadUi(normalizedThreadId, { status: nextStatus });
      if (normalizedThreadId === activeThreadRef.current) {
        setStatus(nextStatus);
      }
      return;
    }
    if (!activeThreadRef.current) {
      setStatus(nextStatus);
    }
  };

  const setActivityDetailForThread = (threadId, nextDetail) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    if (normalizedThreadId) {
      updateThreadUi(normalizedThreadId, { activityDetail: nextDetail });
      if (normalizedThreadId === activeThreadRef.current) {
        setActivityDetail(nextDetail);
      }
      return;
    }
    if (!activeThreadRef.current) {
      setActivityDetail(nextDetail);
    }
  };

  const resolveThreadIdFromTurn = (threadId, turnId) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    if (normalizedThreadId) {
      return normalizedThreadId;
    }
    if (typeof turnId === "string" && turnId) {
      return normalizeThreadId(turnThreadIdRef.current[turnId]) || "";
    }
    return "";
  };

  return {
    messages,
    setMessages,
    input,
    setInputForActiveThread,
    status,
    setStatus,
    setStatusForActiveThread,
    setStatusForThread,
    activityDetail,
    setActivityDetail,
    setActivityDetailForActiveThread,
    setActivityDetailForThread,
    messagesByThreadId,
    setMessagesByThreadId,
    threadUiByThreadId,
    setThreadUiByThreadId,
    messagesByThreadIdRef,
    threadUiByThreadIdRef,
    activeThreadRef,
    turnThreadIdRef,
    restoreThreadMessages,
    appendMessageToThread,
    applyMessageMutationForThread,
    updateThreadUi,
    resolveThreadIdFromTurn,
  };
}
