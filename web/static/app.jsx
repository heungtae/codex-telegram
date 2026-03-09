const { useEffect, useMemo, useRef, useState } = React;

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
        <button className="primary" type="submit">Sign in</button>
        {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
      </form>
    </div>
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

  const startThread = async () => {
    await api("/api/threads/start", { method: "POST", body: "{}" });
    await loadThreads();
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
    el.style.height = `${Math.max(44, next)}px`;
  };

  const interrupt = async () => {
    await api("/api/threads/interrupt", { method: "POST", body: "{}" });
    setStatus("idle");
  };

  const viewThread = async (threadId) => {
    setActiveThread(threadId);
    const result = await api(`/api/threads/read?thread_id=${encodeURIComponent(threadId)}`);
    setMessages([{ role: "system", text: result.text }]);
  };

  const runCommand = async (line) => {
    const cmd = (line || "").trim();
    if (!cmd) {
      return;
    }
    const result = await api("/api/command", {
      method: "POST",
      body: JSON.stringify({ command_line: cmd }),
    });
    setMessages((prev) => [...prev, { role: "system", text: `$ ${cmd}\n\n${result.text}` }]);
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

    const es = new EventSource("/api/events/stream", { withCredentials: true });
    es.addEventListener("turn_delta", (ev) => {
      const data = JSON.parse(ev.data);
      const text = data.text || "";
      if (!text) {
        return;
      }
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant" && last.streaming) {
          last.text += text;
          return copy;
        }
        copy.push({ role: "assistant", text, streaming: true });
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
          <div className="thread-list">
            {(sessionSummary?.agents || []).map((agent) => (
              <div key={agent.name} className={`agent-item ${agent.enabled ? "on" : "off"}`}>
                <span>{agent.name}</span>
                <span>{agent.enabled ? "enabled" : "disabled"}</span>
              </div>
            ))}
          </div>
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
          <div className="user-pill">User: {me.username}</div>
          <div>
            <span className={`status-pill ${status === "running" ? "running" : "idle"}`}>
              {status === "running" ? "Running" : "Ready"}
            </span>
          </div>
        </div>
        <div className="chat" ref={chatRef}>
          {messages.map((m, idx) => (
            <div key={idx} className={`msg ${m.role}`}>
              <strong>{m.role === "user" ? "You" : m.role === "assistant" ? "Codex" : "System"}</strong>
              <div>{m.text}</div>
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
              <button className="danger" onClick={interrupt}>Stop</button>
            ) : (
              <button className="primary" onClick={sendMessage}>Send</button>
            )}
            <button className="secondary" onClick={startThread}>New Chat</button>
          </div>
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
