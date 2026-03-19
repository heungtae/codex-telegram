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
        options: ["decision_only", "summary"],
      },
    ],
  },
};

const THEME_STORAGE_KEY = "codex-web-theme";
const DEFAULT_THEME = "dark";
const GUARDIAN_RULES_TOML_FALLBACK = "# Loading Guardian rules...\n";
const EVENT_PANEL_KINDS = new Set(["file_change", "reasoning", "web_search", "image_generation"]);

function formatGuardianRulesEditor(config) {
  const raw = typeof config?.rules_toml === "string" ? config.rules_toml : "";
  return raw.trim() ? raw : GUARDIAN_RULES_TOML_FALLBACK;
}

function normalizeTheme(theme) {
  return theme === "light" ? "light" : "dark";
}

function readDocumentTheme() {
  if (typeof document === "undefined") {
    return DEFAULT_THEME;
  }
  return normalizeTheme(document.documentElement.dataset.theme);
}

function applyDocumentTheme(theme) {
  if (typeof document === "undefined") {
    return;
  }
  const nextTheme = normalizeTheme(theme);
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme;
}

function persistTheme(theme) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, normalizeTheme(theme));
  } catch (_err) {}
}

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

function ThemeIcon({ theme }) {
  if (theme === "light") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11 2h2v3h-2zM11 19h2v3h-2zM2 11h3v2H2zM19 11h3v2h-3zM5.64 4.22l2.12 2.12-1.42 1.41-2.12-2.12zM16.24 14.83l2.12 2.12-1.42 1.41-2.12-2.12zM4.22 18.36l2.12-2.12 1.41 1.42-2.12 2.12zM16.83 7.76l2.12-2.12 1.41 1.42-2.12 2.12zM12 7a5 5 0 1 0 5 5 5 5 0 0 0-5-5z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.04 2.3a8.74 8.74 0 0 0-1.69 5.19 8.9 8.9 0 0 0 8.89 8.89 8.74 8.74 0 0 0 .46-.01A9 9 0 1 1 14.04 2.3Z" />
    </svg>
  );
}

function Login({ onLoggedIn, theme, onToggleTheme }) {
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
        <div className="login-card-head">
          <div className="login-copy">
            <h2>Codex Telegram</h2>
            <p>Sign in with your allowlisted account.</p>
          </div>
          <button
            className="theme-toggle"
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            <ThemeIcon theme={theme} />
            <span>{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
        </div>
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
        {error ? <p className="login-error">{error}</p> : null}
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

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.14 12.94a7.43 7.43 0 0 0 .05-.94 7.43 7.43 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.28 7.28 0 0 0-1.63-.94L14.4 2.8a.49.49 0 0 0-.49-.4h-3.84a.49.49 0 0 0-.49.4l-.36 2.52c-.58.23-1.13.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.68 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.43 7.43 0 0 0-.05.94 7.43 7.43 0 0 0 .05.94L2.8 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.52a.49.49 0 0 0 .49.4h3.84a.49.49 0 0 0 .49-.4l.36-2.52c.58-.23 1.13-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
    </svg>
  );
}

function normalizePlanStatus(raw) {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (value === "completed") {
    return "completed";
  }
  if (value === "inprogress" || value === "in_progress" || value === "in-progress") {
    return "in_progress";
  }
  return "pending";
}

function formatPlanChecklistText(explanation, plan) {
  const lines = [];
  const summary = typeof explanation === "string" ? explanation.trim() : "";
  if (summary) {
    lines.push(summary);
  }
  const steps = Array.isArray(plan) ? plan : [];
  for (const entry of steps) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const step = typeof entry.step === "string" ? entry.step.trim() : "";
    if (!step) {
      continue;
    }
    const status = normalizePlanStatus(entry.status);
    const marker =
      status === "completed" ? "[done]" : status === "in_progress" ? "[doing]" : "[todo]";
    lines.push(`${marker} ${step}`);
  }
  return lines.join("\n").trim();
}

function summarizeReasoningStatus(text) {
  const normalized = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  if (!normalized) {
    return "";
  }
  return normalized.length > 96 ? `${normalized.slice(0, 93)}...` : normalized;
}

function formatEventPanelTitle(kind) {
  if (kind === "reasoning") {
    return "Reasoning";
  }
  if (kind === "web_search") {
    return "Web Search";
  }
  if (kind === "image_generation") {
    return "Image Generation";
  }
  return "";
}

function formatWebSearchAction(action) {
  if (!action || typeof action !== "object") {
    return "";
  }
  const keys = Object.keys(action);
  if (!keys.length) {
    return "";
  }
  const key = keys[0];
  const value = action[key];
  if (value && typeof value === "object") {
    const query = typeof value.query === "string" ? value.query : "";
    const url = typeof value.url === "string" ? value.url : "";
    const pattern = typeof value.pattern === "string" ? value.pattern : "";
    const parts = [query, url, pattern].filter(Boolean);
    return parts.length ? `${key}: ${parts.join(" | ")}` : key;
  }
  return key;
}

function normalizeThreadId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function parseDiffLineNumber(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function renderDiffRows(diffText) {
  const source = typeof diffText === "string" ? diffText : "";
  if (!source) {
    return [];
  }
  const lines = source.split("\n");
  const rows = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      oldLine = parseDiffLineNumber(hunkMatch[1]);
      newLine = parseDiffLineNumber(hunkMatch[2]);
      rows.push({
        type: "hunk",
        left: "",
        right: "",
        text: line,
      });
      continue;
    }
    if (
      line.startsWith("diff ") ||
      line.startsWith("index ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ") ||
      line.startsWith("rename ") ||
      line.startsWith("new file") ||
      line.startsWith("deleted file")
    ) {
      rows.push({
        type: "meta",
        left: "",
        right: "",
        text: line,
      });
      continue;
    }
    if (line.startsWith("+")) {
      rows.push({
        type: "add",
        left: "",
        right: String(newLine),
        text: line,
      });
      newLine += 1;
      continue;
    }
    if (line.startsWith("-")) {
      rows.push({
        type: "del",
        left: String(oldLine),
        right: "",
        text: line,
      });
      oldLine += 1;
      continue;
    }
    rows.push({
      type: "ctx",
      left: oldLine > 0 ? String(oldLine) : "",
      right: newLine > 0 ? String(newLine) : "",
      text: line,
    });
    if (line !== "\\ No newline at end of file") {
      if (oldLine > 0) {
        oldLine += 1;
      }
      if (newLine > 0) {
        newLine += 1;
      }
    }
  }
  return rows;
}

function FileChangeDiff({ diff }) {
  const rows = renderDiffRows(diff);
  if (!rows.length) {
    return null;
  }
  return (
    <div className="file-change-code" role="table" aria-label="File change diff">
      {rows.map((row, index) => (
        <div key={`diff:${index}`} className={`file-change-code-row type-${row.type}`} role="row">
          <span className="file-change-code-line" role="cell">{row.left}</span>
          <span className="file-change-code-line" role="cell">{row.right}</span>
          <span className="file-change-code-text" role="cell">{row.text || " "}</span>
        </div>
      ))}
    </div>
  );
}

function groupMessagesForRender(messages) {
  const groups = [];
  let panel = null;
  for (const message of Array.isArray(messages) ? messages : []) {
    if (EVENT_PANEL_KINDS.has(message?.kind)) {
      if (!panel) {
        panel = { type: "event_panel", entries: [] };
        groups.push(panel);
      }
      panel.entries.push(message);
      continue;
    }
    panel = null;
    groups.push({ type: "message", message });
  }
  return groups;
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
  const [activityDetail, setActivityDetail] = useState("");
  const [collaborationMode, setCollaborationMode] = useState("build");
  const [modeSwitchBusy, setModeSwitchBusy] = useState(false);
  const [approvalItems, setApprovalItems] = useState([]);
  const [approvalBusyId, setApprovalBusyId] = useState(null);
  const [agentConfigs, setAgentConfigs] = useState({});
  const [agentConfigRawEditors, setAgentConfigRawEditors] = useState({});
  const [activeAgentSettings, setActiveAgentSettings] = useState("");
  const [floatingAgentSettings, setFloatingAgentSettings] = useState("");
  const [agentConfigLoading, setAgentConfigLoading] = useState("");
  const [agentConfigSaving, setAgentConfigSaving] = useState("");
  const [agentConfigError, setAgentConfigError] = useState("");
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const reasoningStateRef = useRef({});
  const pendingComposerFocusRef = useRef(false);
  const paletteRef = useRef(null);
  const [theme, setTheme] = useState(() => readDocumentTheme());
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
      "/collab",
      "/features",
      "/modes",
      "/mode",
      "/plan",
      "/build",
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
  const renderItems = useMemo(() => groupMessagesForRender(messages), [messages]);

  const loadSession = async () => {
    try {
      const who = await api("/api/auth/me");
      setMe(who);
    } catch (_e) {
      setMe(null);
    }
  };

  const loadThreads = async () => {
    const summaries = await api("/api/threads/summaries?limit=20&offset=0");
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
    setStatus(summary?.active_turn_id ? "running" : "idle");
    if (typeof summary?.collaboration_mode === "string") {
      setCollaborationMode(normalizeCollaborationMode(summary.collaboration_mode));
    }
    if (summary && typeof summary.active_thread_id === "string" && summary.active_thread_id) {
      setActiveThread(summary.active_thread_id);
    }
  };
  const loadApprovals = async () => {
    const result = await api("/api/approvals");
    const items = Array.isArray(result.items) ? result.items : [];
    const filtered = items.filter((item) => item && typeof item.id === "number");
    setApprovalItems(filtered.length ? [filtered[filtered.length - 1]] : []);
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
    pendingComposerFocusRef.current = true;
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

  const syncAgentConfig = (agentName, config, syncRulesEditor = true) => {
    setAgentConfigs((prev) => ({ ...prev, [agentName]: config }));
    if (agentName === "guardian" && syncRulesEditor) {
      setAgentConfigRawEditors((prev) => ({
        ...prev,
        [agentName]: formatGuardianRulesEditor(config),
      }));
    }
  };

  const loadAgentConfig = async (agentName, options = {}) => {
    const { syncRulesEditor = true } = options;
    const def = AGENT_CONFIG_DEFS[agentName];
    if (!def) {
      return null;
    }
    setAgentConfigError("");
    setAgentConfigLoading(agentName);
    try {
      const config = await api(def.path);
      syncAgentConfig(agentName, config, syncRulesEditor);
      return config;
    } finally {
      setAgentConfigLoading((current) => (current === agentName ? "" : current));
    }
  };

  const buildAgentPayload = (agentName, draft, options = {}) => {
    const { includeRules = false } = options;
    if (agentName !== "guardian") {
      return draft;
    }
    const payload = {
      enabled: !!draft.enabled,
      timeout_seconds: Number(draft.timeout_seconds ?? 20),
      failure_policy: String(draft.failure_policy ?? "manual_fallback"),
      explainability: String(draft.explainability ?? "decision_only"),
    };
    if (!includeRules) {
      return payload;
    }
    const rawRules = agentConfigRawEditors[agentName] ?? formatGuardianRulesEditor(draft);
    return { ...payload, rules_toml: rawRules };
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
    if (activeAgentSettings === agentName) {
      setActiveAgentSettings("");
      setFloatingAgentSettings((current) => (current === agentName ? "" : current));
      setAgentConfigError("");
      return;
    }
    setActiveAgentSettings(agentName);
    if (agentName !== "guardian") {
      setFloatingAgentSettings("");
    }
    if (agentConfigs[agentName]) {
      if (agentName === "guardian" && !agentConfigRawEditors[agentName]) {
        setAgentConfigRawEditors((prev) => ({
          ...prev,
          [agentName]: formatGuardianRulesEditor(agentConfigs[agentName]),
        }));
      }
      setAgentConfigError("");
      return;
    }
    try {
      await loadAgentConfig(agentName);
    } catch (err) {
      setAgentConfigError(err.message || "Failed to load settings.");
    }
  };

  const toggleFloatingAgentSettings = (agentName) => {
    if (!agentName || activeAgentSettings !== agentName) {
      return;
    }
    setFloatingAgentSettings((current) => (current === agentName ? "" : agentName));
    setAgentConfigError("");
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

  const saveAgentSettings = async (agentName = activeAgentSettings, options = {}) => {
    const { includeRules = agentName === activeAgentSettings && agentName === "guardian" } = options;
    const def = AGENT_CONFIG_DEFS[agentName];
    const draft = agentConfigs[agentName];
    if (!def || !draft || agentConfigSaving || agentConfigLoading) {
      return;
    }
    setAgentConfigError("");
    setAgentConfigSaving(agentName);
    try {
      const payload = buildAgentPayload(agentName, draft, { includeRules });
      const saved = await api(def.path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      syncAgentConfig(agentName, saved, includeRules);
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
    pendingComposerFocusRef.current = true;
    setInput("");
    if (text.startsWith("/")) {
      await runCommand(text);
      return;
    }
    const messageThreadId = normalizeThreadId(activeThread);
    setMessages((prev) => [...prev, { role: "user", text, threadId: messageThreadId }]);
    setStatus("running");
    try {
      const result = await api("/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({ text, thread_id: activeThread || undefined }),
      });
      if (result.local_command) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: result.output || "",
            threadId: normalizeThreadId(result.thread_id) || messageThreadId,
          },
        ]);
        setStatus("idle");
        loadSessionSummary().catch(() => {});
      }
    } catch (err) {
      setStatus("idle");
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: err.message || "Request failed.",
          threadId: messageThreadId,
          streaming: false,
        },
      ]);
      loadSessionSummary().catch(() => {});
    }
  };

  const normalizeCollaborationMode = (raw) => {
    if (typeof raw !== "string") {
      return "build";
    }
    return raw.trim().toLowerCase() === "plan" ? "plan" : "build";
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
          streaming: false,
        },
      ]);
    } finally {
      setModeSwitchBusy(false);
    }
  };

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
      }
    });
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
            kind: item.kind === "plan" ? "plan" : "",
            threadId: normalizeThreadId(item.thread_id) || normalizeThreadId(threadId),
            streaming: false,
          }))
      );
      return;
    }
    setMessages([
      {
        role: "assistant",
        text: result.text,
        threadId: normalizeThreadId(result.thread_id) || normalizeThreadId(threadId),
        streaming: false,
      },
    ]);
  };

  const runCommand = async (line) => {
    const cmd = (line || "").trim();
    if (!cmd) {
      return;
    }
    setMessages((prev) => [
      ...prev,
      { role: "user", text: cmd, threadId: normalizeThreadId(activeThread) },
    ]);
    setStatus("running");
    const result = await api("/api/command", {
      method: "POST",
      body: JSON.stringify({ command_line: cmd }),
    });
    if (result?.meta?.collaboration_mode) {
      setCollaborationMode(normalizeCollaborationMode(result.meta.collaboration_mode));
    }
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        text: result.text,
        threadId: normalizeThreadId(result?.meta?.thread_id) || normalizeThreadId(activeThread),
      },
    ]);
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
    const nextTheme = normalizeTheme(theme);
    applyDocumentTheme(nextTheme);
    persistTheme(nextTheme);
  }, [theme]);

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
      const threadId = normalizeThreadId(data.thread_id);
      const turnId = typeof data.turn_id === "string" && data.turn_id ? data.turn_id : "";
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (
          last &&
          last.role === "assistant" &&
          last.streaming &&
          (last.variant || "") === variant &&
          ((last.turnId || "") === turnId || !turnId)
        ) {
          last.text += text;
          if (!last.threadId && threadId) {
            last.threadId = threadId;
          }
          if (!last.turnId && turnId) {
            last.turnId = turnId;
          }
          return copy;
        }
        copy.push({ role: "assistant", text, variant, threadId, turnId, streaming: true });
        return copy;
      });
    });
    es.addEventListener("plan_delta", (ev) => {
      const data = JSON.parse(ev.data);
      upsertPlanMessage("append", data);
    });
    es.addEventListener("plan_completed", (ev) => {
      const data = JSON.parse(ev.data);
      upsertPlanMessage("final", data);
      loadSessionSummary().catch(() => {});
    });
    es.addEventListener("plan_checklist", (ev) => {
      const data = JSON.parse(ev.data);
      upsertPlanChecklist(data);
    });
    es.addEventListener("reasoning_status", (ev) => {
      const data = JSON.parse(ev.data);
      appendReasoningStatus(data);
    });
    es.addEventListener("reasoning_completed", (ev) => {
      const data = JSON.parse(ev.data);
      completeReasoning(data);
    });
    es.addEventListener("web_search_item", (ev) => {
      const data = JSON.parse(ev.data);
      const query = typeof data?.query === "string" ? data.query.trim() : "";
      const actionText = formatWebSearchAction(data?.action);
      if (!query && !actionText) {
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          kind: "web_search",
          threadId: normalizeThreadId(data?.thread_id),
          turnId: typeof data?.turn_id === "string" ? data.turn_id : "",
          itemId: typeof data?.item_id === "string" ? data.item_id : "",
          text: query || "Web search",
          detail: actionText,
          streaming: false,
        },
      ]);
    });
    es.addEventListener("image_generation_item", (ev) => {
      const data = JSON.parse(ev.data);
      const detailLines = [];
      const revisedPrompt = typeof data?.revised_prompt === "string" ? data.revised_prompt.trim() : "";
      const savedPath = typeof data?.saved_path === "string" ? data.saved_path.trim() : "";
      const statusText = typeof data?.status === "string" ? data.status.trim() : "";
      if (statusText) {
        detailLines.push(`Status: ${statusText}`);
      }
      if (savedPath) {
        detailLines.push(`Saved to: ${savedPath}`);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          kind: "image_generation",
          threadId: normalizeThreadId(data?.thread_id),
          turnId: typeof data?.turn_id === "string" ? data.turn_id : "",
          itemId: typeof data?.item_id === "string" ? data.item_id : "",
          text: revisedPrompt || "Generated image",
          detail: detailLines.join("\n"),
          streaming: false,
        },
      ]);
    });
    es.addEventListener("context_compacted_item", (ev) => {
      const data = JSON.parse(ev.data);
      const text = typeof data?.text === "string" && data.text.trim() ? data.text.trim() : "Context compacted";
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text,
          threadId: normalizeThreadId(data?.thread_id),
          turnId: typeof data?.turn_id === "string" ? data.turn_id : "",
          streaming: false,
        },
      ]);
    });
    es.addEventListener("turn_started", (ev) => {
      const data = JSON.parse(ev.data);
      const actualMode = data?.params?.collaboration_mode_kind || data?.params?.collaborationModeKind;
      if (typeof actualMode === "string") {
        setCollaborationMode(normalizeCollaborationMode(actualMode));
      }
      reasoningStateRef.current = {};
      setActivityDetail("");
      setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
      setStatus("running");
    });
    es.addEventListener("turn_completed", () => {
      setStatus("idle");
      reasoningStateRef.current = {};
      setActivityDetail("");
      setMessages((prev) => prev.map((m) => ({ ...m, streaming: false })));
      loadThreads().catch(() => {});
      loadSessionSummary().catch(() => {});
    });
    es.addEventListener("turn_failed", (ev) => {
      const data = JSON.parse(ev.data);
      const text = data.text || "Turn failed.";
      const threadId = normalizeThreadId(data.thread_id);
      setStatus("idle");
      reasoningStateRef.current = {};
      setActivityDetail("");
      setMessages((prev) => [...prev, { role: "system", text, threadId, streaming: false }]);
      loadSessionSummary().catch(() => {});
    });
    es.addEventListener("approval_required", (ev) => {
      const data = JSON.parse(ev.data);
      if (!data || typeof data.id !== "number") {
        return;
      }
      setApprovalBusyId(null);
      setApprovalItems([data]);
    });
    es.addEventListener("system_message", (ev) => {
      const data = JSON.parse(ev.data);
      const text = data.text || "";
      if (!text) {
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text,
          threadId: normalizeThreadId(data.thread_id),
          streaming: false,
        },
      ]);
      loadSessionSummary().catch(() => {});
    });
    es.addEventListener("file_change", (ev) => {
      const data = JSON.parse(ev.data);
      const summary = data.summary || data.text || "";
      const files = Array.isArray(data.files) ? data.files : [];
      const diff = typeof data.diff === "string" ? data.diff : "";
      const threadId = normalizeThreadId(data.thread_id);
      if (!summary && files.length === 0 && !diff) {
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: summary || "Applied patch changes",
          files,
          diff,
          threadId,
          kind: "file_change",
          streaming: false,
        },
      ]);
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
    if (!chatRef.current) {
      return;
    }
    const panels = chatRef.current.querySelectorAll(".file-change-panel-scroll");
    panels.forEach((panel) => {
      panel.scrollTop = panel.scrollHeight;
    });
  }, [renderItems]);

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
  useEffect(() => {
    if (floatingAgentSettings && floatingAgentSettings !== activeAgentSettings) {
      setFloatingAgentSettings("");
    }
  }, [activeAgentSettings, floatingAgentSettings]);

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
    focusComposer(cursor);
  };

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  const upsertPlanMessage = (mode, payload) => {
    const itemId = typeof payload?.item_id === "string" ? payload.item_id : "";
    const text = typeof payload?.text === "string" ? payload.text : "";
    if (!itemId || !text) {
      return;
    }
    setMessages((prev) => {
      const next = [...prev];
      const existingIndex = next.findIndex(
        (message) => message.kind === "plan" && message.itemId === itemId
      );
      const streaming = mode !== "final";
      if (existingIndex >= 0) {
        const existing = next[existingIndex];
        next[existingIndex] = {
          ...existing,
          role: "assistant",
          kind: "plan",
          itemId,
          threadId: normalizeThreadId(payload?.thread_id),
          text: mode === "append" ? `${existing.text || ""}${text}` : text,
          streaming,
        };
        return next;
      }
      next.push({
        role: "assistant",
        kind: "plan",
        itemId,
        threadId: normalizeThreadId(payload?.thread_id),
        text,
        streaming,
      });
      return next;
    });
  };

  const upsertPlanChecklist = (payload) => {
    const text = formatPlanChecklistText(payload?.explanation, payload?.plan);
    const turnId = typeof payload?.turn_id === "string" ? payload.turn_id : "";
    if (!text || !turnId) {
      return;
    }
    setMessages((prev) => {
      const next = [...prev];
      const existingIndex = next.findIndex(
        (message) => message.kind === "plan_checklist" && message.turnId === turnId
      );
      const value = {
        role: "system",
        kind: "plan_checklist",
        threadId: normalizeThreadId(payload?.thread_id),
        turnId,
        text,
        plan: Array.isArray(payload?.plan) ? payload.plan : [],
        explanation: typeof payload?.explanation === "string" ? payload.explanation : "",
        streaming: false,
      };
      if (existingIndex >= 0) {
        next[existingIndex] = { ...next[existingIndex], ...value };
        return next;
      }
      next.push(value);
      return next;
    });
  };

  const appendReasoningStatus = (payload) => {
    const itemId = typeof payload?.item_id === "string" ? payload.item_id : "";
    if (!itemId) {
      return;
    }
    const existing = reasoningStateRef.current[itemId] || {
      itemId,
      turnId: typeof payload?.turn_id === "string" ? payload.turn_id : "",
      threadId: normalizeThreadId(payload?.thread_id),
      summary: "",
      raw: "",
    };
    if (payload?.section_break && existing.summary && !existing.summary.endsWith("\n\n")) {
      existing.summary += "\n\n";
    }
    if (payload?.raw) {
      if (typeof payload?.delta === "string" && payload.delta) {
        existing.raw += payload.delta;
      }
    } else if (typeof payload?.delta === "string" && payload.delta) {
      existing.summary += payload.delta;
    }
    if (!existing.turnId && typeof payload?.turn_id === "string") {
      existing.turnId = payload.turn_id;
    }
    if (!existing.threadId) {
      existing.threadId = normalizeThreadId(payload?.thread_id);
    }
    reasoningStateRef.current[itemId] = existing;
    setActivityDetail(summarizeReasoningStatus(existing.summary) || "Reasoning");
  };

  const completeReasoning = (payload) => {
    const itemId = typeof payload?.item_id === "string" ? payload.item_id : "";
    const existing = (itemId && reasoningStateRef.current[itemId]) || null;
    const summaryText = Array.isArray(payload?.summary_text)
      ? payload.summary_text.filter((entry) => typeof entry === "string" && entry.trim())
      : [];
    const rawContent = Array.isArray(payload?.raw_content)
      ? payload.raw_content.filter((entry) => typeof entry === "string" && entry.trim())
      : [];
    const summary = (summaryText.length ? summaryText.join("\n\n") : existing?.summary || "").trim();
    const raw = (rawContent.length ? rawContent.join("\n\n") : existing?.raw || "").trim();
    if (itemId) {
      delete reasoningStateRef.current[itemId];
    }
    setActivityDetail("");
    if (!summary) {
      return;
    }
    setMessages((prev) => [
      ...prev,
      {
        role: "system",
        kind: "reasoning",
        threadId: normalizeThreadId(payload?.thread_id) || existing?.threadId || "",
        turnId: typeof payload?.turn_id === "string" ? payload.turn_id : existing?.turnId || "",
        itemId,
        text: summary,
        rawReasoning: raw,
        streaming: false,
      },
    ]);
  };

  if (!me) {
    return <Login onLoggedIn={loadSession} theme={theme} onToggleTheme={toggleTheme} />;
  }

  const activeAgentDef = activeAgentSettings ? AGENT_CONFIG_DEFS[activeAgentSettings] : null;
  const activeAgentConfig = activeAgentSettings ? agentConfigs[activeAgentSettings] : null;
  const floatingAgentConfig = floatingAgentSettings ? agentConfigs[floatingAgentSettings] : null;
  const guardianRuleSummary =
    activeAgentSettings === "guardian"
      ? (activeAgentConfig?.rule_summary || { enabled: 0, total: 0, action_counts: {}, top: [] })
      : null;
  const guardianRulesEditor =
    activeAgentSettings === "guardian"
      ? (agentConfigRawEditors[activeAgentSettings] ??
        formatGuardianRulesEditor(activeAgentConfig))
      : "";
  const settingsBusy = !!agentConfigLoading || !!agentConfigSaving;
  const interactionBusy = status === "running";
  const composerLocked = interactionBusy;

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
                    <SettingsIcon />
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
                  {activeAgentSettings === "guardian" ? (
                    <div className="agent-settings-summary">
                      <div className="agent-settings-summary-title">
                        Rules: {guardianRuleSummary.enabled || 0}/{guardianRuleSummary.total || 0} enabled
                      </div>
                      {guardianRuleSummary.action_counts ? (
                        <div className="agent-settings-summary-actions">
                          {["approve", "session", "deny", "manual_fallback"].map((action) => (
                            <span key={action}>
                              {action}: {guardianRuleSummary.action_counts[action] || 0}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {Array.isArray(guardianRuleSummary.top) && guardianRuleSummary.top.length ? (
                        <div className="agent-settings-summary-list">
                          {guardianRuleSummary.top.slice(0, 3).map((rule, index) => (
                            <div key={`${rule.name || "rule"}:${index}`} className="agent-settings-summary-item">
                              <span>{rule.name || "unnamed-rule"}</span>
                              <span>{`${rule.action || "deny"} · p${rule.priority || 0}`}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="agent-settings-empty">No guardian policy rules configured.</div>
                      )}
                      <div className="agent-settings-summary-footer">
                        <button
                          className={`agent-settings-inline-btn ${floatingAgentSettings === "guardian" ? "active" : ""}`}
                          type="button"
                          onClick={() => toggleFloatingAgentSettings("guardian")}
                          disabled={settingsBusy}
                          aria-label="Rules TOML"
                          title="Rules TOML"
                        >
                          <SettingsIcon />
                          <span>Settings</span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <div className="agent-settings-actions">
                    <button
                      className="agent-settings-action"
                      type="button"
                      onClick={() =>
                        loadAgentConfig(activeAgentSettings, {
                          syncRulesEditor: activeAgentSettings !== "guardian",
                        }).catch((err) => {
                          setAgentConfigError(err.message || "Failed to refresh settings.");
                        })
                      }
                      disabled={settingsBusy}
                      aria-label="새로고침"
                      title="새로고침"
                    >
                      <RefreshIcon />
                    </button>
                    <button
                      className="agent-settings-action agent-settings-action-primary"
                      type="button"
                      onClick={() =>
                        saveAgentSettings(activeAgentSettings, {
                          includeRules: false,
                        })
                      }
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
                disabled={interactionBusy}
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
          <div className="topbar-actions">
            <button
              className="theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              <ThemeIcon theme={theme} />
              <span>{theme === "dark" ? "Dark" : "Light"}</span>
            </button>
            <span className={`status-pill ${interactionBusy ? "running" : "idle"}`}>
              {interactionBusy ? "Running" : "Ready"}
            </span>
          </div>
        </div>
        {activityDetail ? <div className="activity-indicator">{activityDetail}</div> : null}
        {floatingAgentSettings === "guardian" ? (
          <div className="agent-floating-settings">
            <div className="agent-floating-settings-card">
              <div className="agent-settings-head">
                <strong>Guardian Rules TOML</strong>
                <button
                  className="agent-floating-settings-close"
                  type="button"
                  onClick={() => setFloatingAgentSettings("")}
                  disabled={settingsBusy}
                >
                  Close
                </button>
              </div>
              {floatingAgentConfig ? (
                <div className="agent-settings-form">
                  <label className="agent-field">
                    <span>Rules TOML</span>
                    <textarea
                      className="agent-field-textarea"
                      value={guardianRulesEditor}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setAgentConfigRawEditors((prev) => ({
                          ...prev,
                          [floatingAgentSettings]: nextValue,
                        }));
                      }}
                      disabled={settingsBusy}
                      spellCheck={false}
                    />
                    <span className="agent-field-help">
                      Only rules that already exist in `conf.toml` are active. If none are configured, commented examples from `conf.toml.example` are shown here.
                    </span>
                  </label>
                  <div className="agent-floating-settings-note">
                    Timeout, failure policy, and explainability stay in the left settings card.
                  </div>
                  <div className="agent-settings-actions">
                    <button
                      className="agent-settings-action"
                      type="button"
                      onClick={() => loadAgentConfig(floatingAgentSettings, { syncRulesEditor: true }).catch((err) => {
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
                      onClick={() => saveAgentSettings(floatingAgentSettings, { includeRules: true })}
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
          </div>
        ) : null}
        <div className="chat" ref={chatRef}>
          {approvalItems.length ? (
            <div className="approval-stack">
              {approvalItems.map((item) => (
                <div key={item.id} className="approval">
                  <div className="approval-title">Approval required</div>
                  <div>Method: {item.method || "-"}</div>
                  <div>Request ID: {item.id}</div>
                  {item.policy_rule ? <div>Policy: {item.policy_rule}</div> : null}
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
          {renderItems.map((item, idx) => {
            if (item.type === "event_panel") {
              return (
                <div key={`file-panel:${idx}`} className="msg-row file-panel">
                  <div className="file-change-panel">
                    <div className="file-change-panel-scroll">
                      {item.entries.map((entry, entryIdx) => (
                        <div
                          key={`file-entry:${idx}:${entryIdx}`}
                          className={`file-change-entry kind-${entry.kind || "event"}`}
                        >
                          {entry.kind !== "file_change" ? (
                            <div className="file-change-label">{formatEventPanelTitle(entry.kind)}</div>
                          ) : null}
                          <div className="file-change-summary">{entry.text}</div>
                          {entry.detail ? <div className="file-change-files">{entry.detail}</div> : null}
                          {Array.isArray(entry.files) && entry.files.length ? (
                            <div className="file-change-files">
                              {entry.files.map((file, fileIdx) => (
                                <div key={`${file.path || "file"}:${fileIdx}`}>
                                  {(file.change_type || "M")} {file.path || "-"} (+{Number(file.additions || 0)} -{Number(file.deletions || 0)})
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {entry.rawReasoning ? (
                            <details className="event-panel-details">
                              <summary>Raw reasoning</summary>
                              <div className="file-change-files">{entry.rawReasoning}</div>
                            </details>
                          ) : null}
                          {entry.diff ? <FileChangeDiff diff={entry.diff} /> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }
            const m = item.message;
            return (
              <div key={idx} className={`msg-row ${m.role}`}>
                <div className={`msg ${m.role}${m.variant ? ` ${m.variant}` : ""}${m.kind ? ` kind-${m.kind}` : ""}`}>
                  {m.kind === "plan" ? <div className="msg-label">Plan</div> : null}
                  {m.kind === "plan_checklist" ? <div className="msg-label">Plan Checklist</div> : null}
                  <div className="msg-body">{m.text}</div>
                  {m.threadId ? <div className="msg-meta">threadId: {m.threadId}</div> : null}
                </div>
              </div>
            );
          })}
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
              <div className={`composer-input-shell mode-${collaborationMode}`}>
                <button
                  type="button"
                  className={`composer-mode mode-${collaborationMode}`}
                  disabled={composerLocked || modeSwitchBusy}
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => {
                    toggleComposerMode().catch(() => {});
                    focusComposer();
                  }}
                  title="Press Tab to toggle mode"
                  aria-label={`Collaboration mode ${collaborationMode}. Press Tab to toggle.`}
                >
                  <span className="composer-mode-label">{collaborationMode.toUpperCase()}</span>
                  <span className="composer-mode-key">TAB</span>
                </button>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  disabled={composerLocked}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (composerLocked) {
                      return;
                    }
                    if (e.isComposing) {
                      return;
                    }
                    if (e.key === "Tab" && !e.altKey && !e.ctrlKey && !e.metaKey) {
                      e.preventDefault();
                      toggleComposerMode().catch(() => {});
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
            <button className="composer-action composer-new-chat" onClick={startThread} aria-label="New chat" title="New chat" disabled={interactionBusy}>
              <NewChatIcon />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
