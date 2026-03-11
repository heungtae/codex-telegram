const { useEffect, useMemo, useRef, useState } = React;

const AGENT_CONFIG_DEFS = {
  guardian: {
    title: "Guardian settings",
    path: "/api/guardian",
    fields: [
      { key: "timeout_seconds", label: "Timeout", type: "select", options: [3, 8, 20, 60] },
      {
        key: "failure_policy",
        label: "Failure policy",
        type: "select",
        options: ["manual_fallback", "deny", "approve", "session"],
      },
      {
        key: "explainability",
        label: "Explainability",
        type: "select",
        options: ["decision_only", "summary", "full_chain"],
      },
    ],
  },
  reviewer: {
    title: "Reviewer settings",
    path: "/api/reviewer",
    fields: [
      { key: "max_attempts", label: "Max attempts", type: "select", options: [1, 2, 3, 4, 5] },
      { key: "timeout_seconds", label: "Timeout", type: "select", options: [3, 8, 20, 60] },
      { key: "recent_turn_pairs", label: "Recent turn pairs", type: "select", options: [1, 2, 3, 5] },
    ],
  },
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.detail || "Request failed");
  }
  return body;
}

function Login({ onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      onLoggedIn();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <h2>Codex Telegram</h2>
        <p>Sign in with your allowlisted account.</p>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="login-actions">
          <button className="primary" type="submit">Sign in</button>
        </div>
        {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
      </form>
    </div>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.4 20.4 21 12 3.4 3.6l.02 6.53 12.58 1.87-12.58 1.87-.02 6.53Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7h10v10H7z" />
    </svg>
  );
}

function NewChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5c-4.42 0-8 2.91-8 6.5 0 2.02 1.13 3.82 2.9 5.01L6 20l3.63-1.98c.76.17 1.55.26 2.37.26 4.42 0 8-2.91 8-6.5S16.42 5 12 5Zm1 6h3v2h-3v3h-2v-3H8v-2h3V8h2v3Z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 12.65-5.65Z" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7Zm-5 16a3 3 0 1 1 3-3 3 3 0 0 1-3 3Zm3-10H5V5h10Z" />
    </svg>
  );
}

function App() {
  const PALETTE_LIMIT = 10;
  const SIDEBAR_MIN = 260;
  const SIDEBAR_MAX = 620;
  const [me, setMe] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [activeThread, setActiveThread] = useState("");
  const [threadItems, setThreadItems] = useState([]);
  const [projectSuggestions, setProjectSuggestions] = useState([]);
  const [skillSuggestions, setSkillSuggestions] = useState([]);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [status, setStatus] = useState("idle");
  const [approvalItems, setApprovalItems] = useState([]);
  const [approvalBusyId, setApprovalBusyId] = useState(null);
  const [agentConfigs, setAgentConfigs] = useState({});
  const [activeAgentSettings, setActiveAgentSettings] = useState("");
  const [agentConfigLoading, setAgentConfigLoading] = useState("");
  const [agentConfigSaving, setAgentConfigSaving] = useState("");
  const [agentConfigError, setAgentConfigError] = useState("");
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const paletteRef = useRef(null);
  const [paletteSelectedIndex, setPaletteSelectedIndex] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const slashCommands = useMemo(
    () => [
      "/commands",
      "/start",
      "/resume",
      "/fork",
      "/threads",
      "/read",
      "/archive",
      "/unarchive",
      "/compact",
      "/rollback",
      "/interrupt",
      "/review",
      "/exec",
      "/projects",
      "/project",
      "/models",
      "/features",
      "/modes",
      "/skills",
      "/apps",
      "/mcp",
      "/config",
    ],
    []
  );
  const activeToken = useMemo(() => {
    if (input.startsWith("/")) {
      const commandToken = input.slice(1);
      if (!commandToken || /\s/.test(commandToken)) {
        return null;
      }
      return {
        type: "slash",
        query: commandToken.toLowerCase(),
        start: 0,
        end: input.length,
      };
    }
    const lastToken = input.split(/\s+/).pop() || "";
    const match = lastToken.match(/^([@$])([^\s]*)$/);
    if (!match) {
      return null;
    }
    const marker = match[1];
    const typed = match[2] || "";
    const end = input.length;
    const start = end - lastToken.length;
    return {
      type: marker === "@" ? "project" : "skill",
      query: typed.toLowerCase(),
      start,
      end,
    };
  }, [input]);
  const paletteItems = useMemo(() => {
    if (!activeToken) {
      return [];
    }
    const query = activeToken.query;
    if (activeToken.type === "slash") {
      if (!query) {
        return slashCommands;
      }
      return slashCommands.filter((cmd) => cmd.toLowerCase().includes(`/${query}`));
    }
    if (activeToken.type === "project") {
      return projectSuggestions;
    }
    if (!query) {
      return skillSuggestions;
    }
    return skillSuggestions.filter((name) => name.toLowerCase().includes(query));
  }, [activeToken, projectSuggestions, skillSuggestions, slashCommands]);
  const paletteOpen = paletteItems.length > 0;
  const paletteWindowStart = useMemo(
    () => Math.floor(paletteSelectedIndex / PALETTE_LIMIT) * PALETTE_LIMIT,
    [paletteSelectedIndex]
  );
  const visiblePaletteItems = useMemo(
    () => paletteItems.slice(paletteWindowStart, paletteWindowStart + PALETTE_LIMIT),
    [paletteItems, paletteWindowStart]
  );

  const loadSession = async () => {
    try {
      const who = await api("/api/auth/me");
      setMe(who);
    } catch (_e) {
      setMe(null);
    }
  };

  const loadThreads = async () => {
    const summaries = await api("/api/threads/summaries?limit=30&offset=0");
    const items = Array.isArray(summaries.items) ? summaries.items : [];
    setThreadItems(items);
    if (!activeThread && items.length > 0) {
      setActiveThread(items[0].id);
    }
  };

  const loadSkillSuggestions = async () => {
    const skillsResult = await api("/api/skills");
    const skills = Array.isArray(skillsResult.meta?.skill_names) ? skillsResult.meta.skill_names : [];
    setSkillSuggestions([...new Set(skills.filter((v) => typeof v === "string" && v))]);
  };
  const loadSessionSummary = async () => {
    const summary = await api("/api/session/summary");
    setSessionSummary(summary);
    if (summary && typeof summary.active_thread_id === "string" && summary.active_thread_id) {
      setActiveThread(summary.active_thread_id);
    }
  };
  const loadApprovals = async () => {
    const result = await api("/api/approvals");
    const items = Array.isArray(result.items) ? result.items : [];
    setApprovalItems(items.filter((item) => item && typeof item.id === "number"));
  };

  const submitApproval = async (requestId, decision) => {
    if (typeof requestId !== "number" || !decision || approvalBusyId !== null) {
      return;
    }
    setApprovalBusyId(requestId);
    try {
      await api(`/api/approvals/${requestId}`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      setApprovalItems((prev) => prev.filter((item) => item.id !== requestId));
    } finally {
      setApprovalBusyId(null);
    }
  };

  const startThread = async () => {
    const result = await api("/api/threads/start", { method: "POST", body: "{}" });
    const nextThreadId = result?.meta?.thread_id;
    setMessages([]);
    setStatus("idle");
    if (typeof nextThreadId === "string" && nextThreadId) {
      setActiveThread(nextThreadId);
    } else {
      await loadSessionSummary();
    }
    await loadThreads();
  };

  const patchSessionAgent = (agentName, enabled) => {
    setSessionSummary((prev) => {
      if (!prev || !Array.isArray(prev.agents)) {
        return prev;
      }
      return {
        ...prev,
        agents: prev.agents.map((agent) =>
          agent.name === agentName ? { ...agent, enabled } : agent
        ),
      };
    });
  };

  const loadAgentConfig = async (agentName) => {
    const def = AGENT_CONFIG_DEFS[agentName];
    if (!def) {
      return null;
    }
    setAgentConfigError("");
    setAgentConfigLoading(agentName);
    try {
      const config = await api(def.path);
      setAgentConfigs((prev) => ({ ...prev, [agentName]: config }));
      return config;
    } finally {
      setAgentConfigLoading((current) => (current === agentName ? "" : current));
    }
  };

  const toggleAgent = async (agentName) => {
    const def = AGENT_CONFIG_DEFS[agentName];
    if (!def || agentConfigSaving || agentConfigLoading) {
      return;
    }
    setAgentConfigError("");
    setAgentConfigSaving(agentName);
    try {
      const current = agentConfigs[agentName] || (await loadAgentConfig(agentName));
      if (!current) {
        return;
      }
      const saved = await api(def.path, {
        method: "POST",
        body: JSON.stringify({ ...current, enabled: !current.enabled }),
      });
      setAgentConfigs((prev) => ({ ...prev, [agentName]: saved }));
      patchSessionAgent(agentName, !!saved.enabled);
    } catch (err) {
      setAgentConfigError(err.message || "Failed to update agent.");
    } finally {
      setAgentConfigSaving("");
    }
  };

  const openAgentSettings = async (agentName) => {
    const def = AGENT_CONFIG_DEFS[agentName];
    if (!def) {
      return;
    }
    setActiveAgentSettings(agentName);
    if (agentConfigs[agentName]) {
      setAgentConfigError("");
      return;
    }
    try {
      await loadAgentConfig(agentName);
    } catch (err) {
      setAgentConfigError(err.message || "Failed to load settings.");
    }
  };

  const updateAgentDraft = (agentName, key, value) => {
    setAgentConfigs((prev) => ({
      ...prev,
      [agentName]: {
        ...(prev[agentName] || {}),
        [key]: value,
      },
    }));
  };

  const saveAgentSettings = async () => {
    const agentName = activeAgentSettings;
    const def = AGENT_CONFIG_DEFS[agentName];
    const draft = agentConfigs[agentName];
    if (!def || !draft || agentConfigSaving || agentConfigLoading) {
      return;
    }
    setAgentConfigError("");
    setAgentConfigSaving(agentName);
    try {
      const saved = await api(def.path, {
        method: "POST",
        body: JSON.stringify(draft),
      });
      setAgentConfigs((prev) => ({ ...prev, [agentName]: saved }));
      patchSessionAgent(agentName, !!saved.enabled);
    } catch (err) {
      setAgentConfigError(err.message || "Failed to save settings.");
    } finally {
      setAgentConfigSaving("");
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) {
      return;
    }
    const text = input.trim();
    setInput("");
    if (text.startsWith("/")) {
      await runCommand(text);
      return;
    }
    setMessages((prev) => [...prev, { role: "user", text }]);
    setStatus("running");
    const result = await api("/api/chat/messages", {
      method: "POST",
      body: JSON.stringify({ text, thread_id: activeThread || undefined }),
    });
    if (result.local_command) {
      setMessages((prev) => [...prev, { role: "assistant", text: result.output || "" }]);
      setStatus("idle");
      loadSessionSummary().catch(() => {});
    }
  };

  const autoResizeInput = () => {
    const el = inputRef.current;
    if (!el) {
      return;
    }
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 240);
    el.style.height = `${Math.max(40, next)}px`;
  };

  const interrupt = async () => {
    await api("/api/threads/interrupt", { method: "POST", body: "{}" });
    setStatus("idle");
  };

  const viewThread = async (threadId) => {
    setActiveThread(threadId);
    setStatus("idle");
    const result = await api(`/api/threads/read?thread_id=${encodeURIComponent(threadId)}`);
    if (Array.isArray(result.messages) && result.messages.length > 0) {
      setMessages(
        result.messages
          .filter((item) => item && typeof item.text === "string" && item.text.trim())
          .map((item) => ({
            role: item.role === "user" ? "user" : item.role === "assistant" ? "assistant" : "system",
            text: item.text,
            variant: item.variant === "subagent" ? "subagent" : "",
            streaming: false,
          }))
      );
      return;
    }
    setMessages([{ role: "assistant", text: result.text, streaming: false }]);
  };

  const runCommand = async (line) => {
    const cmd = (line || "").trim();
    if (!cmd) {
      return;
    }
    setMessages((prev) => [...prev, { role: "user", text: cmd }]);
    setStatus("running");
    const result = await api("/api/command", {
      method: "POST",
      body: JSON.stringify({ command_line: cmd }),
    });
    setMessages((prev) => [...prev, { role: "assistant", text: result.text }]);
    setStatus("idle");
    if (
      cmd.startsWith("/threads") ||
      cmd.startsWith("/start") ||
      cmd.startsWith("/resume") ||
      cmd.startsWith("/project")
    ) {
      loadThreads().catch(() => {});
    }
    loadSessionSummary().catch(() => {});
  };

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (!me) {
      return;
    }
    loadThreads().catch(() => {});
    loadSkillSuggestions().catch(() => {});
    loadSessionSummary().catch(() => {});
    loadApprovals().catch(() => {});

    const es = new EventSource("/api/events/stream", { withCredentials: true });
    es.addEventListener("turn_delta", (ev) => {
      const data = JSON.parse(ev.data);
      const text = data.text || "";
      if (!text) {
        return;
      }
      const variant = data.variant === "subagent" ? "subagent" : "";
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant" && last.streaming && (last.variant || "") === variant) {
          last.text += text;
          return copy;
        }
        copy.push({ role: "assistant", text, variant, streaming: true });
        return copy;
      });
    });
    es.addEventListener("turn_completed", () => {
      setStatus("idle");
      setMessages((prev) => prev.map((m) => ({ ...m, streaming: false })));
      loadThreads().catch(() => {});
      loadSessionSummary().catch(() => {});
    });
    es.addEventListener("turn_failed", () => {
      setStatus("idle");
      setMessages((prev) => [...prev, { role: "system", text: "Turn failed." }]);
      loadSessionSummary().catch(() => {});
    });
    es.addEventListener("approval_required", (ev) => {
      const data = JSON.parse(ev.data);
      if (!data || typeof data.id !== "number") {
        return;
      }
      setApprovalItems((prev) => {
        const next = prev.filter((item) => item.id !== data.id);
        next.push(data);
        return next.sort((a, b) => a.id - b.id);
      });
    });
    es.addEventListener("system_message", (ev) => {
      const data = JSON.parse(ev.data);
      const text = data.text || "";
      if (!text) {
        return;
      }
      setMessages((prev) => [...prev, { role: "system", text, streaming: false }]);
    });
    es.onerror = () => {
      setStatus("disconnected");
    };

    return () => es.close();
  }, [me]);

  useEffect(() => {
    if (!chatRef.current) {
      return;
    }
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    autoResizeInput();
  }, [input]);

  useEffect(() => {
    setPaletteSelectedIndex(0);
  }, [activeToken?.type, activeToken?.query]);
  useEffect(() => {
    if (paletteSelectedIndex < paletteItems.length) {
      return;
    }
    setPaletteSelectedIndex(0);
  }, [paletteItems.length, paletteSelectedIndex]);
  useEffect(() => {
    if (!paletteOpen || !paletteRef.current) {
      return;
    }
    const container = paletteRef.current;
    const active = container.querySelector(".slash-item.active");
    if (!active) {
      return;
    }
    active.scrollIntoView({ block: "nearest" });
  }, [paletteOpen, paletteSelectedIndex, visiblePaletteItems.length]);
  useEffect(() => {
    if (!isResizingSidebar) {
      return;
    }
    const onMove = (event) => {
      const next = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, event.clientX));
      setSidebarWidth(next);
    };
    const onUp = () => setIsResizingSidebar(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizingSidebar]);
  useEffect(() => {
    if (!activeToken || activeToken.type !== "project") {
      setProjectSuggestions([]);
      return;
    }
    const prefix = activeToken.query || "";
    api(`/api/workspace/suggestions?prefix=${encodeURIComponent(prefix)}&limit=200`)
      .then((result) => {
        const items = Array.isArray(result.items) ? result.items : [];
        setProjectSuggestions(items.filter((v) => typeof v === "string" && v));
      })
      .catch(() => {
        setProjectSuggestions([]);
      });
  }, [activeToken?.type, activeToken?.query]);

  const applyPaletteItem = (item) => {
    if (!activeToken) {
      return;
    }
    let next = input;
    let cursor = input.length;
    if (activeToken.type === "slash") {
      next = `${item} `;
      cursor = next.length;
    } else if (activeToken.type === "project") {
      next = `${input.slice(0, activeToken.start)}@${item}${input.slice(activeToken.end)}`;
      cursor = activeToken.start + item.length + 1;
    } else {
      next = `${input.slice(0, activeToken.start)}$${item}${input.slice(activeToken.end)}`;
      cursor = activeToken.start + item.length + 1;
    }
    setInput(next);
    queueMicrotask(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.selectionStart = cursor;
        inputRef.current.selectionEnd = cursor;
      }
    });
  };

  if (!me) {
    return <Login onLoggedIn={loadSession} />;
  }

  const activeAgentDef = activeAgentSettings ? AGENT_CONFIG_DEFS[activeAgentSettings] : null;
  const activeAgentConfig = activeAgentSettings ? agentConfigs[activeAgentSettings] : null;
  const settingsBusy =
    (!!activeAgentSettings && agentConfigLoading === activeAgentSettings) ||
    (!!activeAgentSettings && agentConfigSaving === activeAgentSettings);

  return (
    <div className="app">
      <aside className="sidebar" style={{ width: sidebarWidth }}>
        <div className="brand">Codex Telegram</div>
        <div className="panel">
          <h3>Current Thread</h3>
          <div className="meta-line"><b>ThreadId</b></div>
          <div className="meta-value">{activeThread || sessionSummary?.active_thread_id || "-"}</div>
          <div className="meta-line"><b>Workspace</b></div>
          <div className="meta-value">{sessionSummary?.workspace || "-"}</div>
        </div>
        <div className="panel">
          <h3>Enabled Agents</h3>
          <div className="thread-list agent-list">
            {(sessionSummary?.agents || []).map((agent) => (
              <div key={agent.name} className="agent-row">
                <button
                  className={`agent-item ${agent.enabled ? "on" : "off"} ${AGENT_CONFIG_DEFS[agent.name] ? "clickable" : "static"}`}
                  onClick={() => toggleAgent(agent.name)}
                  disabled={!AGENT_CONFIG_DEFS[agent.name] || !!agentConfigLoading || !!agentConfigSaving}
                  type="button"
                >
                  <span>{agent.name}</span>
                  <span>{agent.enabled ? "enabled" : "disabled"}</span>
                </button>
                {AGENT_CONFIG_DEFS[agent.name] ? (
                  <button
                    className="agent-settings-btn"
                    onClick={() => openAgentSettings(agent.name)}
                    disabled={!!agentConfigLoading || !!agentConfigSaving}
                    aria-label={`${agent.name} 설정`}
                    title={`${agent.name} 설정`}
                    type="button"
                  >
                    <svg
                      className="agent-settings-icon"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M19.14 12.94a7.43 7.43 0 0 0 .05-.94 7.43 7.43 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.28 7.28 0 0 0-1.63-.94L14.4 2.8a.49.49 0 0 0-.49-.4h-3.84a.49.49 0 0 0-.49.4l-.36 2.52c-.58.23-1.13.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.68 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.43 7.43 0 0 0-.05.94 7.43 7.43 0 0 0 .05.94L2.8 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.52a.49.49 0 0 0 .49.4h3.84a.49.49 0 0 0 .49-.4l.36-2.52c.58-.23 1.13-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
                    </svg>
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {agentConfigError ? <div className="agent-error">{agentConfigError}</div> : null}
          {activeAgentDef ? (
            <div className="agent-settings-card">
              <div className="agent-settings-head">
                <strong>{activeAgentDef.title}</strong>
                <span className={`agent-status-chip ${(activeAgentConfig?.enabled ?? false) ? "on" : "off"}`}>
                  {(activeAgentConfig?.enabled ?? false) ? "enabled" : "disabled"}
                </span>
              </div>
              {activeAgentConfig ? (
                <div className="agent-settings-form">
                  {activeAgentDef.fields.map((field) => (
                    <label key={field.key} className="agent-field">
                      <span>{field.label}</span>
                      <select
                        value={String(activeAgentConfig[field.key] ?? "")}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const nextValue = typeof field.options[0] === "number" ? Number(raw) : raw;
                          updateAgentDraft(activeAgentSettings, field.key, nextValue);
                        }}
                        disabled={settingsBusy}
                      >
                        {field.options.map((option) => (
                          <option key={String(option)} value={String(option)}>
                            {String(option)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <div className="agent-settings-actions">
                    <button
                      className="agent-settings-action"
                      type="button"
                      onClick={() => loadAgentConfig(activeAgentSettings).catch((err) => {
                        setAgentConfigError(err.message || "Failed to refresh settings.");
                      })}
                      disabled={settingsBusy}
                      aria-label="새로고침"
                      title="새로고침"
                    >
                      <RefreshIcon />
                    </button>
                    <button
                      className="agent-settings-action agent-settings-action-primary"
                      type="button"
                      onClick={saveAgentSettings}
                      disabled={settingsBusy}
                      aria-label="저장"
                      title="저장"
                    >
                      <SaveIcon />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="agent-settings-empty">설정을 불러오는 중입니다.</div>
              )}
            </div>
          ) : null}
        </div>
        <div className="panel threads-panel">
          <h3>Threads</h3>
          <div className="thread-list">
            {threadItems.map((item) => (
              <button
                key={item.id}
                className="thread-item"
                onClick={() => viewThread(item.id)}
                disabled={status === "running"}
              >
                <div className="thread-title">{item.title || "Untitled"}</div>
                <div className="thread-sub">{item.id}</div>
              </button>
            ))}
          </div>
        </div>
      </aside>
      <div
        className={`sidebar-resizer ${isResizingSidebar ? "active" : ""}`}
        onMouseDown={() => setIsResizingSidebar(true)}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
      />
      <main className="main">
        <div className="topbar">
          <div className="user-pill" aria-label={`User ${me.username}`}>
            <svg className="user-pill-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.33 0-6 1.79-6 4v1h12v-1c0-2.21-2.67-4-6-4Z" />
            </svg>
            <span>{me.username}</span>
          </div>
          <div>
            <span className={`status-pill ${status === "running" ? "running" : "idle"}`}>
              {status === "running" ? "Running" : "Ready"}
            </span>
          </div>
        </div>
        <div className="chat" ref={chatRef}>
          {approvalItems.length ? (
            <div className="approval-stack">
              {approvalItems.map((item) => (
                <div key={item.id} className="approval">
                  <div className="approval-title">Approval required</div>
                  <div>Method: {item.method || "-"}</div>
                  <div>Request ID: {item.id}</div>
                  {item.reason ? <div>Reason: {item.reason}</div> : null}
                  {item.question ? <div>Question: {item.question}</div> : null}
                  <div className="approval-actions">
                    <button
                      className="secondary"
                      type="button"
                      disabled={approvalBusyId === item.id}
                      onClick={() => submitApproval(item.id, "approve")}
                    >
                      Approve
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      disabled={approvalBusyId === item.id}
                      onClick={() => submitApproval(item.id, "session")}
                    >
                      Session
                    </button>
                    <button
                      className="danger"
                      type="button"
                      disabled={approvalBusyId === item.id}
                      onClick={() => submitApproval(item.id, "deny")}
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {messages.map((m, idx) => (
            <div key={idx} className={`msg-row ${m.role}`}>
              <div className={`msg ${m.role}${m.variant ? ` ${m.variant}` : ""}`}>
                <div className="msg-body">{m.text}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="composer">
          <div className="composer-inner">
            <div className="input-wrap">
              {paletteOpen ? (
                <div className="slash-panel" ref={paletteRef}>
                  {visiblePaletteItems.map((item, idx) => {
                    const absoluteIndex = paletteWindowStart + idx;
                    return (
                    <button
                      key={`${activeToken?.type || "t"}:${item}`}
                      className={`slash-item ${absoluteIndex === paletteSelectedIndex ? "active" : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyPaletteItem(item);
                      }}
                    >
                      {activeToken?.type === "project" ? "@" : activeToken?.type === "skill" ? "$" : ""}
                      {item}
                    </button>
                    );
                  })}
                </div>
              ) : null}
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.isComposing) {
                    return;
                  }
                  if (paletteOpen && e.key === "ArrowDown") {
                    e.preventDefault();
                    setPaletteSelectedIndex((prev) => (prev + 1) % paletteItems.length);
                    return;
                  }
                  if (paletteOpen && e.key === "ArrowUp") {
                    e.preventDefault();
                    setPaletteSelectedIndex((prev) =>
                      (prev - 1 + paletteItems.length) % paletteItems.length
                    );
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
                    setInput(next);
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
                }}
                placeholder="Message..."
              />
            </div>
            {status === "running" ? (
              <button className="composer-action composer-stop" onClick={interrupt} aria-label="Stop" title="Stop">
                <StopIcon />
              </button>
            ) : (
              <button className="composer-action composer-send" onClick={sendMessage} aria-label="Send" title="Send">
                <SendIcon />
              </button>
            )}
            <button className="composer-action composer-new-chat" onClick={startThread} aria-label="New chat" title="New chat">
              <NewChatIcon />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
