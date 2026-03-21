import { useEffect, useRef, useState } from "react";

import { createEmptyThreadUiState, normalizeThreadId } from "../../common/utils";

export default function useThreadScopedState(activeThread) {
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
    if (!normalizedThreadId) {
      setMessages((prev) => [...prev, message]);
      return;
    }
    if (normalizedThreadId === normalizeThreadId(activeThread)) {
      setMessages((prev) => [...prev, message]);
      return;
    }
    setMessagesByThreadId((prev) => {
      const existing = Array.isArray(prev[normalizedThreadId]) ? prev[normalizedThreadId] : [];
      return { ...prev, [normalizedThreadId]: [...existing, message] };
    });
  };

  const applyMessageMutationForThread = (threadId, mutateFn) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    if (!normalizedThreadId || normalizedThreadId === normalizeThreadId(activeThread)) {
      setMessages((prev) => mutateFn(prev));
      return;
    }
    setMessagesByThreadId((prev) => {
      const current = Array.isArray(prev[normalizedThreadId]) ? prev[normalizedThreadId] : [];
      return { ...prev, [normalizedThreadId]: mutateFn(current) };
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
