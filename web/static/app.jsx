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
const PROJECT_CLICK_MODE_STORAGE_KEY = "codex-web-project-click-mode";
const TURN_NOTIFICATION_STORAGE_KEY = "codex-web-turn-notification-enabled";
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

function readProjectClickMode() {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    const value = window.localStorage.getItem(PROJECT_CLICK_MODE_STORAGE_KEY) || "";
    return value === "open_new_tab" || value === "replace_current" ? value : "";
  } catch (_err) {
    return "";
  }
}

function persistProjectClickMode(mode) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(PROJECT_CLICK_MODE_STORAGE_KEY, mode);
  } catch (_err) {}
}

function readTurnNotificationEnabled() {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    const value = window.localStorage.getItem(TURN_NOTIFICATION_STORAGE_KEY);
    if (value === "0") {
      return false;
    }
    if (value === "1") {
      return true;
    }
  } catch (_err) {}
  return true;
}

function persistTurnNotificationEnabled(enabled) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(TURN_NOTIFICATION_STORAGE_KEY, enabled ? "1" : "0");
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

function SidebarChevronIcon({ collapsed }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {collapsed ? (
        <path d="M8.59 7.41 10 6l6 6-6 6-1.41-1.41L13.17 12 8.59 7.41Zm-4 0L6 6l6 6-6 6-1.41-1.41L9.17 12 4.59 7.41Z" />
      ) : (
        <path d="m15.41 7.41-1.41-1.41-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59Zm4 0L18 6l-6 6 6 6 1.41-1.41L14.83 12l4.58-4.59Z" />
      )}
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
      const who = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      onLoggedIn(who);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-card-head">
          <div className="login-copy">
            <h2>Codex Web</h2>
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

function NotificationIcon({ enabled }) {
  if (!enabled) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2v1h16v-1zM9.6 20a2.4 2.4 0 0 0 4.8 0" />
        <path d="M5 5l14 14" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2v1h16v-1zM9.6 20a2.4 2.4 0 0 0 4.8 0" />
    </svg>
  );
}

function CloseTabIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.7 5.3 12 10.6l5.3-5.3 1.4 1.4-5.3 5.3 5.3 5.3-1.4 1.4-5.3-5.3-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3z" />
    </svg>
  );
}

function AddTabIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
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

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
    </svg>
  );
}

function ChevronIcon({ expanded = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {expanded ? <path d="M7 10l5 5 5-5z" /> : <path d="M10 7l5 5-5 5z" />}
    </svg>
  );
}

function FolderIcon({ open = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {open ? (
        <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
      ) : (
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5v1H4zM4 10h16v6.5A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
      )}
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 3h7L19 8.5v11A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3Zm6 1.5V9h4.5" />
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

function normalizeWorkspacePath(value) {
  return typeof value === "string" ? value.replace(/\\/g, "/").replace(/^\/+/, "").trim() : "";
}

function basename(value) {
  const normalized = normalizeWorkspacePath(value);
  if (!normalized) {
    return "";
  }
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

function buildProjectTabId(projectKey) {
  return projectKey ? `project:${projectKey}` : "";
}

function createEmptyWorkspaceState() {
  return {
    tree: {},
    expandedDirs: { "": true },
    status: { is_git: false, items: {} },
    error: "",
    preview: null,
  };
}

function statusClassName(code) {
  if (code === "??") {
    return "status-untracked";
  }
  if (!code) {
    return "";
  }
  return `status-${String(code).toLowerCase()}`;
}

function statusPriority(code) {
  if (code === "??") {
    return 5;
  }
  if (code === "A") {
    return 4;
  }
  if (code === "M") {
    return 3;
  }
  if (code === "R") {
    return 2;
  }
  if (code === "D") {
    return 1;
  }
  return 0;
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

function FileCodePreview({ content }) {
  const rows = typeof content === "string" ? content.split("\n") : [];
  if (!rows.length) {
    return <div className="workspace-preview-empty">File is empty.</div>;
  }
  return (
    <div className="file-change-code workspace-file-code" role="table" aria-label="File preview">
      {rows.map((row, index) => (
        <div key={`file:${index}`} className="file-change-code-row type-ctx" role="row">
          <span className="file-change-code-line" role="cell">{index + 1}</span>
          <span className="file-change-code-line" role="cell" />
          <span className="file-change-code-text" role="cell">{row || " "}</span>
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
  const [me, setMe] = useState(null);
  const [theme, setTheme] = useState(() => readDocumentTheme());

  const loadSession = async () => {
    try {
      const who = await api("/api/auth/me");
      setMe(who);
    } catch (_e) {
      setMe(null);
    }
  };

  const handleLoggedIn = (who) => {
    if (who && typeof who === "object") {
      setMe(who);
      return;
    }
    loadSession().catch(() => {});
  };

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    const nextTheme = normalizeTheme(theme);
    applyDocumentTheme(nextTheme);
    persistTheme(nextTheme);
  }, [theme]);

  if (!me) {
    return <Login onLoggedIn={handleLoggedIn} theme={theme} onToggleTheme={toggleTheme} />;
  }

  return <AuthenticatedApp me={me} theme={theme} onToggleTheme={toggleTheme} />;
}

function AuthenticatedApp({ me, theme, onToggleTheme }) {
  const PALETTE_LIMIT = 10;
  const SIDEBAR_MIN = 260;
  const SIDEBAR_MAX = 620;
  const SIDEBAR_COLLAPSED_WIDTH = 44;
  const WORKSPACE_PANEL_MIN = 280;
  const WORKSPACE_PANEL_MAX = 720;
  const MOBILE_BREAKPOINT = 900;
  const WORKSPACE_PANEL_BREAKPOINT = 1200;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [projectTabs, setProjectTabs] = useState([]);
  const [activeProjectTabId, setActiveProjectTabId] = useState("");
  const [threadTabsByProjectTabId, setThreadTabsByProjectTabId] = useState({});
  const [activeThreadTabIdByProjectTabId, setActiveThreadTabIdByProjectTabId] = useState({});
  const [threadProjectTabIdByThreadId, setThreadProjectTabIdByThreadId] = useState({});
  const [workspaceByProjectTabId, setWorkspaceByProjectTabId] = useState({});
  const [activeThread, setActiveThread] = useState("");
  const [threadItems, setThreadItems] = useState([]);
  const [projectItems, setProjectItems] = useState([]);
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
  const composerFocusWantedRef = useRef(false);
  const composerSelectionRef = useRef({ start: null, end: null });
  const recentBackspaceAtRef = useRef(0);
  const paletteRef = useRef(null);
  const workspaceResizeRef = useRef({ startX: 0, startWidth: 320 });
  const [paletteSelectedIndex, setPaletteSelectedIndex] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [workspacePanelWidth, setWorkspacePanelWidth] = useState(320);
  const [isResizingWorkspacePanel, setIsResizingWorkspacePanel] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= MOBILE_BREAKPOINT : false
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCompactWorkspaceLayout, setIsCompactWorkspaceLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= WORKSPACE_PANEL_BREAKPOINT : false
  );
  const [isWorkspacePanelOpen, setIsWorkspacePanelOpen] = useState(false);
  const [workspaceTree, setWorkspaceTree] = useState({});
  const [expandedWorkspaceDirs, setExpandedWorkspaceDirs] = useState({ "": true });
  const [workspaceStatus, setWorkspaceStatus] = useState({ is_git: false, items: {} });
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspacePreview, setWorkspacePreview] = useState(null);
  const [projectClickMode, setProjectClickMode] = useState(() => readProjectClickMode());
  const [isProjectModeModalOpen, setIsProjectModeModalOpen] = useState(false);
  const [pendingProjectTarget, setPendingProjectTarget] = useState("");
  const [turnNotificationEnabled, setTurnNotificationEnabled] = useState(() => readTurnNotificationEnabled());
  const audioCtxRef = useRef(null);
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
  const activeProjectTab = useMemo(
    () => projectTabs.find((tab) => tab.id === activeProjectTabId) || null,
    [projectTabs, activeProjectTabId]
  );
  const activeProjectKey = activeProjectTab?.key || "";
  const projectTabStatusById = useMemo(() => {
    const next = {};
    projectTabs.forEach((tab) => {
      const rows = Array.isArray(threadTabsByProjectTabId[tab.id]) ? threadTabsByProjectTabId[tab.id] : [];
      if (rows.some((row) => row.status === "running")) {
        next[tab.id] = "running";
        return;
      }
      if (rows.some((row) => row.hasUnreadCompletion)) {
        next[tab.id] = "unread";
        return;
      }
      if (rows.some((row) => row.status === "failed")) {
        next[tab.id] = "failed";
        return;
      }
      if (rows.some((row) => row.status === "cancelled")) {
        next[tab.id] = "cancelled";
        return;
      }
      next[tab.id] = "idle";
    });
    return next;
  }, [projectTabs, threadTabsByProjectTabId]);

  const ensureWorkspaceBucket = (projectTabId) => {
    if (!projectTabId) {
      return;
    }
    setWorkspaceByProjectTabId((prev) => {
      if (prev[projectTabId]) {
        return prev;
      }
      return { ...prev, [projectTabId]: createEmptyWorkspaceState() };
    });
  };

  const upsertProjectTab = (project) => {
    const key = typeof project?.key === "string" ? project.key : "";
    if (!key) {
      return "";
    }
    const tabId = buildProjectTabId(key);
    const tab = {
      id: tabId,
      key,
      name: typeof project?.name === "string" && project.name ? project.name : key,
      path: typeof project?.path === "string" ? project.path : "",
    };
    setProjectTabs((prev) => {
      const index = prev.findIndex((item) => item.id === tabId);
      if (index >= 0) {
        const next = [...prev];
        next[index] = { ...next[index], ...tab };
        return next;
      }
      return [...prev, tab];
    });
    ensureWorkspaceBucket(tabId);
    return tabId;
  };

  const openThreadInProjectTab = (projectTabId, thread) => {
    const threadId = normalizeThreadId(thread?.id);
    if (!projectTabId || !threadId) {
      return "";
    }
    const title = typeof thread?.title === "string" && thread.title ? thread.title : threadId;
    setThreadTabsByProjectTabId((prev) => {
      const rows = Array.isArray(prev[projectTabId]) ? prev[projectTabId] : [];
      const existing = rows.find((row) => row.id === threadId);
      if (existing) {
        return {
          ...prev,
          [projectTabId]: rows.map((row) => (
            row.id === threadId ? { ...row, title, hasUnreadCompletion: false } : row
          )),
        };
      }
      return {
        ...prev,
        [projectTabId]: [...rows, { id: threadId, title, status: "idle", hasUnreadCompletion: false }],
      };
    });
    setThreadProjectTabIdByThreadId((prev) => ({ ...prev, [threadId]: projectTabId }));
    setActiveThreadForProjectTab(projectTabId, threadId);
    return threadId;
  };

  const setActiveThreadForProjectTab = (projectTabId, threadId) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    setActiveThreadTabIdByProjectTabId((prev) => ({ ...prev, [projectTabId]: normalizedThreadId }));
    if (projectTabId === activeProjectTabId) {
      setActiveThread(normalizedThreadId);
    }
  };

  const updateThreadTabState = (threadId, patch) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    if (!normalizedThreadId) {
      return;
    }
    const projectTabId = threadProjectTabIdByThreadId[normalizedThreadId];
    if (!projectTabId) {
      return;
    }
    setThreadTabsByProjectTabId((prev) => {
      const rows = Array.isArray(prev[projectTabId]) ? prev[projectTabId] : [];
      const nextRows = rows.map((row) => (
        row.id === normalizedThreadId ? { ...row, ...patch } : row
      ));
      return { ...prev, [projectTabId]: nextRows };
    });
  };

  const closeThreadTab = (projectTabId, threadId) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    if (!projectTabId || !normalizedThreadId) {
      return;
    }
    setThreadTabsByProjectTabId((prev) => {
      const rows = Array.isArray(prev[projectTabId]) ? prev[projectTabId] : [];
      const index = rows.findIndex((row) => row.id === normalizedThreadId);
      if (index < 0) {
        return prev;
      }
      const nextRows = rows.filter((row) => row.id !== normalizedThreadId);
      const fallback = nextRows[index] || nextRows[index - 1] || nextRows[0];
      if (projectTabId === activeProjectTabId) {
        setActiveThreadForProjectTab(projectTabId, fallback?.id || "");
      } else {
        setActiveThreadTabIdByProjectTabId((mapping) => ({
          ...mapping,
          [projectTabId]: fallback?.id || "",
        }));
      }
      return { ...prev, [projectTabId]: nextRows };
    });
    setThreadProjectTabIdByThreadId((prev) => {
      const next = { ...prev };
      delete next[normalizedThreadId];
      return next;
    });
  };

  const closeProjectTab = (projectTabId) => {
    if (!projectTabId) {
      return;
    }
    const existingTabs = projectTabs;
    const index = existingTabs.findIndex((tab) => tab.id === projectTabId);
    const fallback = index > 0 ? existingTabs[index - 1] : existingTabs[index + 1];
    setProjectTabs((prev) => prev.filter((tab) => tab.id !== projectTabId));
    setThreadTabsByProjectTabId((prev) => {
      const next = { ...prev };
      delete next[projectTabId];
      return next;
    });
    setActiveThreadTabIdByProjectTabId((prev) => {
      const next = { ...prev };
      delete next[projectTabId];
      return next;
    });
    setWorkspaceByProjectTabId((prev) => {
      const next = { ...prev };
      delete next[projectTabId];
      return next;
    });
    setThreadProjectTabIdByThreadId((prev) => {
      const next = { ...prev };
      Object.entries(next).forEach(([threadId, tabId]) => {
        if (tabId === projectTabId) {
          delete next[threadId];
        }
      });
      return next;
    });
    if (activeProjectTabId === projectTabId) {
      setActiveProjectTabId(fallback?.id || "");
      setActiveThread(fallback ? normalizeThreadId(activeThreadTabIdByProjectTabId[fallback.id]) : "");
      setMessages([]);
    }
  };

  const workspaceContextQuery = (extra = {}) => {
    const params = new URLSearchParams();
    const threadId = normalizeThreadId(extra.thread_id || activeThread);
    const projectKey = typeof extra.project_key === "string" && extra.project_key
      ? extra.project_key
      : activeProjectKey;
    if (threadId) {
      params.set("thread_id", threadId);
    } else if (projectKey) {
      params.set("project_key", projectKey);
    }
    return params.toString();
  };

  const playTurnNotification = () => {
    if (!turnNotificationEnabled || typeof window === "undefined") {
      return;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        return;
      }
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) {
        return;
      }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (_err) {}
  };

  const loadThreads = async (options = {}) => {
    const projectKey = typeof options.projectKey === "string" ? options.projectKey : (activeProjectKey || "");
    const projectTabId = typeof options.projectTabId === "string" ? options.projectTabId : (activeProjectTabId || "");
    const ensureDefaultTab = !!options.ensureDefaultTab;
    const query = new URLSearchParams({ limit: "20", offset: "0", archived: "false" });
    if (projectKey) {
      query.set("project_key", projectKey);
    }
    const summaries = await api(`/api/threads/summaries?${query.toString()}`);
    const items = Array.isArray(summaries.items) ? summaries.items : [];
    if (!projectTabId || projectTabId === activeProjectTabId) {
      setThreadItems(items);
    }
    if (ensureDefaultTab && projectTabId) {
      const opened = Array.isArray(threadTabsByProjectTabId[projectTabId]) ? threadTabsByProjectTabId[projectTabId] : [];
      if (opened.length === 0) {
        if (items.length > 0) {
          openThreadInProjectTab(projectTabId, items[0]);
        } else if (projectKey) {
          const created = await api("/api/projects/open-thread", {
            method: "POST",
            body: JSON.stringify({ project_key: projectKey }),
          });
          const createdThreadId = normalizeThreadId(created?.thread_id);
          if (createdThreadId) {
            openThreadInProjectTab(projectTabId, { id: createdThreadId, title: createdThreadId });
          }
        }
      } else if (!normalizeThreadId(activeThreadTabIdByProjectTabId[projectTabId])) {
        setActiveThreadForProjectTab(projectTabId, opened[0]?.id || "");
      }
    }
  };

  const loadProjects = async () => {
    const result = await api("/api/projects");
    const items = Array.isArray(result.items) ? result.items : [];
    setProjectItems(items);
    const selected = items.find((item) => item?.selected) || items[0];
    if (!projectTabs.length && selected) {
      const tabId = upsertProjectTab(selected);
      if (tabId) {
        setActiveProjectTabId(tabId);
      }
      return;
    }
    if (projectTabs.length) {
      setProjectTabs((prev) =>
        prev.map((tab) => {
          const matched = items.find((item) => item?.key === tab.key);
          if (!matched) {
            return tab;
          }
          return {
            ...tab,
            name: matched.name || tab.name,
            path: matched.path || tab.path,
          };
        })
      );
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
    if (!activeProjectTabId && summary && typeof summary.active_thread_id === "string" && summary.active_thread_id) {
      setActiveThread(summary.active_thread_id);
    }
    if (!projectTabs.length && summary && typeof summary.project_key === "string" && summary.project_key) {
      const tabId = upsertProjectTab({
        key: summary.project_key,
        name: summary.project_name || summary.project_key,
        path: summary.workspace || "",
      });
      if (tabId) {
        setActiveProjectTabId((prev) => prev || tabId);
        if (summary.active_thread_id) {
          setActiveThreadForProjectTab(tabId, summary.active_thread_id);
        }
      }
    }
  };
  const loadApprovals = async () => {
    const result = await api("/api/approvals");
    const items = Array.isArray(result.items) ? result.items : [];
    const filtered = items.filter((item) => item && typeof item.id === "number");
    setApprovalItems(filtered.length ? [filtered[filtered.length - 1]] : []);
  };

  const loadWorkspaceTree = async (path = "", options = {}) => {
    const { depth = 1, force = false } = options;
    const normalizedPath = normalizeWorkspacePath(path);
    if (!force && workspaceTree[normalizedPath]) {
      return workspaceTree[normalizedPath];
    }
    const query = new URLSearchParams({
      path: normalizedPath,
      depth: String(depth),
    });
    const ctx = workspaceContextQuery();
    if (ctx) {
      const ctxParams = new URLSearchParams(ctx);
      ctxParams.forEach((value, key) => query.set(key, value));
    }
    const result = await api(`/api/workspace/tree?${query.toString()}`);
    const items = Array.isArray(result.items) ? result.items : [];
    setWorkspaceTree((prev) => ({ ...prev, [normalizedPath]: items }));
    return items;
  };

  const loadWorkspaceStatus = async () => {
    try {
      const ctx = workspaceContextQuery();
      const result = await api(`/api/workspace/status${ctx ? `?${ctx}` : ""}`);
      setWorkspaceStatus({
        is_git: !!result.is_git,
        items: result && typeof result.items === "object" ? result.items : {},
      });
      setWorkspaceError("");
    } catch (err) {
      setWorkspaceStatus({ is_git: false, items: {} });
      setWorkspaceError(err.message || "Failed to load workspace status.");
    }
  };

  const openWorkspaceFile = async (path, statusCode = "") => {
    const normalizedPath = normalizeWorkspacePath(path);
    if (!normalizedPath) {
      return;
    }
    setWorkspaceError("");
    setWorkspacePreview({
      path: normalizedPath,
      mode: statusCode ? "diff" : "file",
      status: statusCode,
      loading: true,
      content: "",
      diff: "",
      previewAvailable: true,
      error: "",
      truncated: false,
      isBinary: false,
    });
    try {
      if (statusCode) {
        const diffQuery = new URLSearchParams({ path: normalizedPath });
        const ctx = workspaceContextQuery();
        if (ctx) {
          const ctxParams = new URLSearchParams(ctx);
          ctxParams.forEach((value, key) => diffQuery.set(key, value));
        }
        const diffResult = await api(`/api/workspace/diff?${diffQuery.toString()}`);
        if (diffResult.has_diff && diffResult.diff) {
          setWorkspacePreview({
            path: normalizedPath,
            mode: "diff",
            status: diffResult.status || statusCode,
            loading: false,
            content: "",
            diff: diffResult.diff,
            previewAvailable: true,
            error: "",
            truncated: false,
            isBinary: false,
          });
          return;
        }
      }
      const fileQuery = new URLSearchParams({ path: normalizedPath });
      const ctx = workspaceContextQuery();
      if (ctx) {
        const ctxParams = new URLSearchParams(ctx);
        ctxParams.forEach((value, key) => fileQuery.set(key, value));
      }
      const fileResult = await api(`/api/workspace/file?${fileQuery.toString()}`);
      setWorkspacePreview({
        path: normalizedPath,
        mode: "file",
        status: statusCode,
        loading: false,
        content: fileResult.content || "",
        diff: "",
        previewAvailable: !!fileResult.preview_available,
        error: "",
        truncated: !!fileResult.truncated,
        isBinary: !!fileResult.is_binary,
      });
    } catch (err) {
      setWorkspacePreview({
        path: normalizedPath,
        mode: statusCode ? "diff" : "file",
        status: statusCode,
        loading: false,
        content: "",
        diff: "",
        previewAvailable: false,
        error: err.message || "Failed to load file preview.",
        truncated: false,
        isBinary: false,
      });
    } finally {
    }
  };

  const toggleWorkspaceDirectory = (path) => {
    const normalizedPath = normalizeWorkspacePath(path);
    const isExpanded = !!expandedWorkspaceDirs[normalizedPath];
    if (isExpanded) {
      setExpandedWorkspaceDirs((prev) => ({ ...prev, [normalizedPath]: false }));
      return;
    }
    setExpandedWorkspaceDirs((prev) => ({ ...prev, [normalizedPath]: true }));
    if (!workspaceTree[normalizedPath]) {
      loadWorkspaceTree(normalizedPath).catch((err) => {
        setWorkspaceError(err.message || "Failed to load workspace tree.");
      });
    }
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
    let nextThreadId = "";
    if (activeProjectKey) {
      const result = await api("/api/projects/open-thread", {
        method: "POST",
        body: JSON.stringify({ project_key: activeProjectKey }),
      });
      nextThreadId = normalizeThreadId(result?.thread_id);
      if (activeProjectTabId && nextThreadId) {
        openThreadInProjectTab(activeProjectTabId, { id: nextThreadId, title: nextThreadId });
      }
    } else {
      const result = await api("/api/threads/start", { method: "POST", body: "{}" });
      nextThreadId = normalizeThreadId(result?.meta?.thread_id);
    }
    setMessages([]);
    setStatus("idle");
    pendingComposerFocusRef.current = true;
    if (nextThreadId) {
      setActiveThread(nextThreadId);
      if (activeProjectTabId) {
        setActiveThreadForProjectTab(activeProjectTabId, nextThreadId);
      }
    } else {
      await loadSessionSummary();
    }
    await loadThreads({ projectKey: activeProjectKey, projectTabId: activeProjectTabId });
  };

  const selectProject = async (target, forcedMode = "") => {
    if (!target || interactionBusy) {
      return;
    }
    const resolvedMode = forcedMode || projectClickMode;
    if (!resolvedMode) {
      setPendingProjectTarget(target);
      setIsProjectModeModalOpen(true);
      return;
    }
    try {
      const selectedProject = projectItems.find((item) => item?.key === target);
      let projectTabId = "";
      if (resolvedMode === "replace_current" && activeProjectTabId) {
        const nextProject = selectedProject || { key: target, name: target, path: "" };
        projectTabId = activeProjectTabId;
        setProjectTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeProjectTabId
              ? {
                  ...tab,
                  key: nextProject.key,
                  name: nextProject.name || nextProject.key,
                  path: nextProject.path || "",
                }
              : tab
          )
        );
        setThreadTabsByProjectTabId((prev) => ({ ...prev, [activeProjectTabId]: [] }));
        setActiveThreadTabIdByProjectTabId((prev) => ({ ...prev, [activeProjectTabId]: "" }));
        setWorkspaceByProjectTabId((prev) => ({ ...prev, [activeProjectTabId]: createEmptyWorkspaceState() }));
        setThreadProjectTabIdByThreadId((prev) => {
          const next = { ...prev };
          Object.entries(next).forEach(([threadId, tabId]) => {
            if (tabId === activeProjectTabId) {
              delete next[threadId];
            }
          });
          return next;
        });
      } else {
        projectTabId = upsertProjectTab(selectedProject || { key: target, name: target, path: "" });
      }
      if (projectTabId) {
        setActiveProjectTabId(projectTabId);
      }
      setMessages([]);
      setStatus("idle");
      setActiveThread("");
      pendingComposerFocusRef.current = true;
      await loadSessionSummary();
      await loadProjects();
      await loadThreads({ projectKey: target, projectTabId, ensureDefaultTab: true });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: err.message || "Failed to switch project.",
          threadId: normalizeThreadId(activeThread),
          turnId: "",
          streaming: false,
        },
      ]);
    }
  };

  const chooseProjectClickMode = (mode) => {
    const normalizedMode = mode === "replace_current" ? "replace_current" : "open_new_tab";
    setProjectClickMode(normalizedMode);
    persistProjectClickMode(normalizedMode);
    const target = pendingProjectTarget;
    setPendingProjectTarget("");
    setIsProjectModeModalOpen(false);
    if (target) {
      selectProject(target, normalizedMode).catch(() => {});
    }
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
    setMessages((prev) => [...prev, { role: "user", text, turnId: "" }]);
    setStatus("running");
    try {
      const result = await api("/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          text,
          thread_id: messageThreadId || undefined,
          project_key: activeProjectKey || undefined,
        }),
      });
      if (result.local_command) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: result.output || "",
            threadId: normalizeThreadId(result.thread_id) || messageThreadId,
            turnId: typeof result.turn_id === "string" ? result.turn_id : "",
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
          turnId: "",
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
          turnId: "",
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
    if (isMobileLayout) {
      setIsSidebarOpen(false);
    }
    const normalizedThreadId = normalizeThreadId(threadId);
    setActiveThread(normalizedThreadId);
    if (activeProjectTabId) {
      const threadInfo = threadItems.find((item) => normalizeThreadId(item?.id) === normalizedThreadId);
      openThreadInProjectTab(activeProjectTabId, {
        id: normalizedThreadId,
        title: threadInfo?.title || normalizedThreadId,
      });
      updateThreadTabState(normalizedThreadId, { hasUnreadCompletion: false });
    }
    setStatus("idle");
    const result = await api(`/api/threads/read?thread_id=${encodeURIComponent(normalizedThreadId)}`);
    if (Array.isArray(result.messages) && result.messages.length > 0) {
      setMessages(
        result.messages
          .filter((item) => item && typeof item.text === "string" && item.text.trim())
          .map((item) => ({
            role: item.role === "user" ? "user" : item.role === "assistant" ? "assistant" : "system",
            text: item.text,
            variant: item.variant === "subagent" ? "subagent" : "",
            kind: item.kind === "plan" ? "plan" : "",
            threadId: normalizeThreadId(item.thread_id) || normalizedThreadId,
            turnId: typeof item.turn_id === "string" ? item.turn_id : "",
            streaming: false,
          }))
      );
      return;
    }
    setMessages([
      {
        role: "assistant",
        text: result.text,
        threadId: normalizeThreadId(result.thread_id) || normalizedThreadId,
        turnId: typeof result.turn_id === "string" ? result.turn_id : "",
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
      { role: "user", text: cmd, turnId: "" },
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
        turnId: typeof result?.meta?.turn_id === "string" ? result.meta.turn_id : "",
      },
    ]);
    setStatus("idle");
    if (
      cmd.startsWith("/threads") ||
      cmd.startsWith("/start") ||
      cmd.startsWith("/resume") ||
      cmd.startsWith("/project")
    ) {
      loadThreads({ projectKey: activeProjectKey, projectTabId: activeProjectTabId }).catch(() => {});
    }
    if (cmd.startsWith("/projects") || cmd.startsWith("/project")) {
      loadProjects().catch(() => {});
    }
    loadSessionSummary().catch(() => {});
  };

  useEffect(() => {
    if (!me) {
      return;
    }
    loadProjects().catch(() => {});
    loadThreads({ projectKey: activeProjectKey, projectTabId: activeProjectTabId }).catch(() => {});
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
      updateThreadTabState(data?.thread_id, { status: "running", hasUnreadCompletion: false });
      const actualMode = data?.params?.collaboration_mode_kind || data?.params?.collaborationModeKind;
      if (typeof actualMode === "string") {
        setCollaborationMode(normalizeCollaborationMode(actualMode));
      }
      reasoningStateRef.current = {};
      setActivityDetail("");
      setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
      setStatus("running");
    });
    es.addEventListener("turn_completed", (ev) => {
      const data = JSON.parse(ev.data);
      const completedThreadId = normalizeThreadId(data?.thread_id);
      const shouldNotify = completedThreadId && completedThreadId !== normalizeThreadId(activeThread);
      updateThreadTabState(completedThreadId, {
        status: "completed",
        hasUnreadCompletion: completedThreadId ? shouldNotify : true,
      });
      if (shouldNotify) {
        playTurnNotification();
      }
      setStatus("idle");
      reasoningStateRef.current = {};
      setActivityDetail("");
      setMessages((prev) => prev.map((m) => ({ ...m, streaming: false })));
      loadThreads({ projectKey: activeProjectKey, projectTabId: activeProjectTabId }).catch(() => {});
      loadProjects().catch(() => {});
      loadSessionSummary().catch(() => {});
      loadWorkspaceStatus().catch(() => {});
    });
    es.addEventListener("turn_failed", (ev) => {
      const data = JSON.parse(ev.data);
      const failedThreadId = normalizeThreadId(data?.thread_id);
      const shouldNotify = failedThreadId && failedThreadId !== normalizeThreadId(activeThread);
      updateThreadTabState(failedThreadId, {
        status: "failed",
        hasUnreadCompletion: failedThreadId ? shouldNotify : true,
      });
      if (shouldNotify) {
        playTurnNotification();
      }
      const text = data.text || "Turn failed.";
      const threadId = normalizeThreadId(data.thread_id);
      const turnId = typeof data.turn_id === "string" ? data.turn_id : "";
      setStatus("idle");
      reasoningStateRef.current = {};
      setActivityDetail("");
      setMessages((prev) => [...prev, { role: "system", text, threadId, turnId, streaming: false }]);
      loadProjects().catch(() => {});
      loadSessionSummary().catch(() => {});
    });
    es.addEventListener("turn_cancelled", (ev) => {
      const data = JSON.parse(ev.data);
      const cancelledThreadId = normalizeThreadId(data?.thread_id);
      const shouldNotify = cancelledThreadId && cancelledThreadId !== normalizeThreadId(activeThread);
      updateThreadTabState(cancelledThreadId, {
        status: "cancelled",
        hasUnreadCompletion: cancelledThreadId ? shouldNotify : true,
      });
      if (shouldNotify) {
        playTurnNotification();
      }
      setStatus("idle");
      reasoningStateRef.current = {};
      setActivityDetail("");
      loadProjects().catch(() => {});
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
          turnId: typeof data.turn_id === "string" ? data.turn_id : "",
          streaming: false,
        },
      ]);
      loadSessionSummary().catch(() => {});
      loadWorkspaceStatus().catch(() => {});
    });
    es.addEventListener("file_change", (ev) => {
      const data = JSON.parse(ev.data);
      const summary = data.summary || data.text || "";
      const files = Array.isArray(data.files) ? data.files : [];
      const diff = typeof data.diff === "string" ? data.diff : "";
      const threadId = normalizeThreadId(data.thread_id);
      const turnId = typeof data.turn_id === "string" ? data.turn_id : "";
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
          turnId,
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
  }, [me, activeProjectKey, activeProjectTabId, activeThread, turnNotificationEnabled]);

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
    if (!composerFocusWantedRef.current || typeof window === "undefined") {
      return undefined;
    }
    const el = inputRef.current;
    if (!el || el.disabled) {
      return undefined;
    }
    if (document.activeElement === el) {
      rememberComposerSelection(el);
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      if (!composerFocusWantedRef.current) {
        return;
      }
      const current = inputRef.current;
      if (!current || current.disabled || document.activeElement === current) {
        return;
      }
      current.focus();
      const { start, end } = composerSelectionRef.current;
      if (typeof start === "number" && typeof end === "number") {
        current.selectionStart = start;
        current.selectionEnd = end;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [input, paletteOpen, paletteSelectedIndex]);

  useEffect(() => {
    setPaletteSelectedIndex(0);
  }, [activeToken?.type, activeToken?.query]);
  useEffect(() => {
    loadThreads({ projectKey: activeProjectKey, projectTabId: activeProjectTabId }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!activeProjectTabId) {
      return;
    }
    setActiveThread(normalizeThreadId(activeThreadTabIdByProjectTabId[activeProjectTabId]) || "");
    const workspaceState = workspaceByProjectTabId[activeProjectTabId] || createEmptyWorkspaceState();
    setWorkspaceTree(workspaceState.tree || {});
    setExpandedWorkspaceDirs(workspaceState.expandedDirs || { "": true });
    setWorkspaceStatus(workspaceState.status || { is_git: false, items: {} });
    setWorkspaceError(workspaceState.error || "");
    setWorkspacePreview(workspaceState.preview || null);
    loadThreads({ projectKey: activeProjectKey, projectTabId: activeProjectTabId, ensureDefaultTab: true }).catch(() => {});
  }, [activeProjectTabId]);

  useEffect(() => {
    if (!activeProjectTabId) {
      return;
    }
    setWorkspaceByProjectTabId((prev) => ({
      ...prev,
      [activeProjectTabId]: {
        tree: workspaceTree,
        expandedDirs: expandedWorkspaceDirs,
        status: workspaceStatus,
        error: workspaceError,
        preview: workspacePreview,
      },
    }));
  }, [
    activeProjectTabId,
    workspaceTree,
    expandedWorkspaceDirs,
    workspaceStatus,
    workspaceError,
    workspacePreview,
  ]);
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
    const workspacePath = activeProjectTab?.path || sessionSummary?.workspace || "";
    if (!workspacePath) {
      setWorkspaceTree({});
      setWorkspaceStatus({ is_git: false, items: {} });
      setWorkspacePreview(null);
      setWorkspaceError("");
      return;
    }
    setExpandedWorkspaceDirs({ "": true });
    loadWorkspaceTree("", { force: true }).catch((err) => {
      setWorkspaceTree({});
      setWorkspaceError(err.message || "Failed to load workspace tree.");
    });
    loadWorkspaceStatus().catch(() => {});
  }, [activeProjectTabId, activeProjectTab?.path, sessionSummary?.workspace]);
  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const syncViewport = () => {
      setIsMobileLayout(window.innerWidth <= MOBILE_BREAKPOINT);
      setIsCompactWorkspaceLayout(window.innerWidth <= WORKSPACE_PANEL_BREAKPOINT);
    };
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);
  useEffect(() => {
    if (!isMobileLayout) {
      setIsSidebarOpen(false);
      return;
    }
    setIsResizingSidebar(false);
  }, [isMobileLayout]);
  useEffect(() => {
    if (!isCompactWorkspaceLayout) {
      setIsWorkspacePanelOpen(false);
      return;
    }
    setIsResizingWorkspacePanel(false);
  }, [isCompactWorkspaceLayout]);
  useEffect(() => {
    if (!isMobileLayout || typeof document === "undefined") {
      return undefined;
    }
    const { body } = document;
    if (!body) {
      return undefined;
    }
    const previousOverflow = body.style.overflow;
    if (isSidebarOpen) {
      body.style.overflow = "hidden";
    }
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [isMobileLayout, isSidebarOpen]);
  useEffect(() => {
    if (!isMobileLayout || !isSidebarOpen || typeof window === "undefined") {
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobileLayout, isSidebarOpen]);
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
    if (!isResizingWorkspacePanel) {
      return;
    }
    const onMove = (event) => {
      const delta = workspaceResizeRef.current.startX - event.clientX;
      const next = workspaceResizeRef.current.startWidth + delta;
      setWorkspacePanelWidth(
        Math.max(WORKSPACE_PANEL_MIN, Math.min(WORKSPACE_PANEL_MAX, next))
      );
    };
    const onUp = () => setIsResizingWorkspacePanel(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizingWorkspacePanel]);
  useEffect(() => {
    if (!activeToken || activeToken.type !== "project") {
      setProjectSuggestions([]);
      return;
    }
    const prefix = activeToken.query || "";
    {
      const query = new URLSearchParams({ prefix, limit: "200" });
      const ctx = workspaceContextQuery();
      if (ctx) {
        const ctxParams = new URLSearchParams(ctx);
        ctxParams.forEach((value, key) => query.set(key, value));
      }
      api(`/api/workspace/suggestions?${query.toString()}`)
      .then((result) => {
        const items = Array.isArray(result.items) ? result.items : [];
        setProjectSuggestions(items.filter((v) => typeof v === "string" && v));
      })
      .catch(() => {
        setProjectSuggestions([]);
      });
    }
  }, [activeToken?.type, activeToken?.query]);
  useEffect(() => {
    if (floatingAgentSettings && floatingAgentSettings !== activeAgentSettings) {
      setFloatingAgentSettings("");
    }
  }, [activeAgentSettings, floatingAgentSettings]);
  useEffect(() => {
    if (!isProjectModeModalOpen || typeof window === "undefined") {
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setPendingProjectTarget("");
        setIsProjectModeModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isProjectModeModalOpen]);

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
          turnId: typeof payload?.turn_id === "string" ? payload.turn_id : existing?.turnId || "",
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
        turnId: typeof payload?.turn_id === "string" ? payload.turn_id : "",
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
  const currentProjectLabel = activeProjectTab?.name || sessionSummary?.project_name || sessionSummary?.project_key || "-";
  const workspaceRootLabel = basename(activeProjectTab?.path || sessionSummary?.workspace || "") || "Workspace";
  const workspaceStatusItems =
    workspaceStatus && typeof workspaceStatus.items === "object" ? workspaceStatus.items : {};
  const workspaceDirectoryStatus = useMemo(() => {
    const next = {};
    for (const [path, value] of Object.entries(workspaceStatusItems)) {
      const normalizedPath = normalizeWorkspacePath(path);
      const code = value?.code || "";
      if (!normalizedPath || !code) {
        continue;
      }
      const parts = normalizedPath.split("/");
      parts.pop();
      let current = "";
      for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        const existing = next[current] || "";
        if (statusPriority(code) > statusPriority(existing)) {
          next[current] = code;
        }
      }
    }
    return next;
  }, [workspaceStatusItems]);
  const deletedWorkspaceEntries = Object.entries(workspaceStatusItems)
    .filter(([path, value]) => value?.code === "D" && !workspaceTree[""]?.some((item) => item.path === path))
    .sort((a, b) => a[0].localeCompare(b[0]));

  const renderWorkspaceTree = (path = "", depth = 0) => {
    const normalizedPath = normalizeWorkspacePath(path);
    const items = Array.isArray(workspaceTree[normalizedPath]) ? workspaceTree[normalizedPath] : [];
    if (!items.length && normalizedPath) {
      return null;
    }
    return items.map((item) => {
      const itemPath = normalizeWorkspacePath(item.path);
      const isDirectory = item.type === "directory";
      const isExpanded = !!expandedWorkspaceDirs[itemPath];
      const statusCode = isDirectory
        ? (workspaceDirectoryStatus[itemPath] || workspaceStatusItems[itemPath]?.code || "")
        : (workspaceStatusItems[itemPath]?.code || "");
      const isSelected = workspacePreview?.path === itemPath;
      return (
        <div key={itemPath} className="workspace-tree-node">
          <button
            type="button"
            className={`workspace-tree-item ${isDirectory ? "directory" : "file"} ${isSelected ? "selected" : ""} ${statusClassName(statusCode)}`}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
            onClick={() => {
              if (isDirectory) {
                toggleWorkspaceDirectory(itemPath);
                return;
              }
              openWorkspaceFile(itemPath, statusCode).catch(() => {});
            }}
          >
            <span className="workspace-tree-icon caret">
              {isDirectory && item.has_children ? <ChevronIcon expanded={isExpanded} /> : null}
            </span>
            <span className="workspace-tree-icon glyph">
              {isDirectory ? <FolderIcon open={isExpanded} /> : <FileIcon />}
            </span>
            <span className="workspace-tree-label">{item.name}</span>
            {statusCode ? <span className="workspace-tree-badge">{statusCode}</span> : null}
          </button>
          {isDirectory && isExpanded ? renderWorkspaceTree(itemPath, depth + 1) : null}
        </div>
      );
    });
  };
  const workspacePanelStyle = isCompactWorkspaceLayout ? undefined : { width: workspacePanelWidth };
  const workspacePanel = (
    <aside
      className={`workspace-panel ${isCompactWorkspaceLayout ? "compact" : "desktop"} ${isWorkspacePanelOpen ? "open" : ""}`}
      style={workspacePanelStyle}
    >
      <div className="workspace-panel-head">
        <div>
          <div className="workspace-panel-title">Workspace Files</div>
          <div className="workspace-panel-subtitle">{workspaceRootLabel}</div>
        </div>
        <button
          className="workspace-refresh"
          type="button"
          onClick={() => {
            loadWorkspaceTree("", { force: true }).catch((err) => {
              setWorkspaceError(err.message || "Failed to refresh workspace tree.");
            });
            loadWorkspaceStatus().catch(() => {});
          }}
          aria-label="Refresh workspace browser"
          title="Refresh workspace browser"
        >
          <RefreshIcon />
        </button>
      </div>
      {workspaceError ? <div className="workspace-panel-state">{workspaceError}</div> : null}
      {!(activeProjectTab?.path || sessionSummary?.workspace) ? (
        <div className="workspace-panel-state">Select a workspace to browse files.</div>
      ) : null}
      {activeProjectTab?.path || sessionSummary?.workspace ? (
        <div className="workspace-tree">
          {deletedWorkspaceEntries.length ? (
            <div className="workspace-tree-group">
              <div className="workspace-tree-group-label">Deleted</div>
              {deletedWorkspaceEntries.map(([path, value]) => (
                <button
                  key={`deleted:${path}`}
                  type="button"
                  className="workspace-tree-item file deleted"
                  onClick={() => openWorkspaceFile(path, value?.code || "D").catch(() => {})}
                >
                  <span className="workspace-tree-icon caret" />
                  <span className="workspace-tree-icon glyph"><FileIcon /></span>
                  <span className="workspace-tree-label">{path}</span>
                  <span className="workspace-tree-badge">{value?.code || "D"}</span>
                </button>
              ))}
            </div>
          ) : null}
          {renderWorkspaceTree("", 0)}
          {Array.isArray(workspaceTree[""]) && workspaceTree[""].length ? null : (
            <div className="workspace-panel-state">No files available.</div>
          )}
        </div>
      ) : null}
    </aside>
  );

  const isDesktopSidebarCollapsed = !isMobileLayout && isSidebarCollapsed;
  const sidebarStyle = isMobileLayout
    ? undefined
    : { width: isDesktopSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth };
  const projectModeModal = isProjectModeModalOpen ? (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={() => {
        setPendingProjectTarget("");
        setIsProjectModeModalOpen(false);
      }}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Project open mode"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-title">프로젝트 탭 동작 선택</div>
        <div className="modal-desc">
          프로젝트 클릭 시 새 탭으로 열지, 현재 탭을 교체할지 선택하세요. 이 선택은 저장됩니다.
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="primary"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => chooseProjectClickMode("open_new_tab")}
          >
            새 탭으로 열기
          </button>
          <button
            type="button"
            className="secondary"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => chooseProjectClickMode("replace_current")}
          >
            현재 탭 교체
          </button>
          <button
            type="button"
            className="ghost"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => {
              setPendingProjectTarget("");
              setIsProjectModeModalOpen(false);
            }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className={`app ${isMobileLayout ? "mobile-layout" : ""}`}>
      {projectModeModal}
      <aside
        id="app-sidebar"
        className={`sidebar ${isMobileLayout ? "mobile" : "desktop"} ${isSidebarOpen ? "open" : ""} ${isDesktopSidebarCollapsed ? "collapsed" : ""}`}
        style={sidebarStyle}
        aria-hidden={isMobileLayout ? !isSidebarOpen : undefined}
      >
        {!isDesktopSidebarCollapsed ? (
          <div className="sidebar-content">
            <div className="sidebar-header-row">
              <div className="brand">Codex Web</div>
              <div className="sidebar-top-actions">
                <button
                  className={`notify-toggle icon-only ${turnNotificationEnabled ? "on" : "off"}`}
                  type="button"
                  onClick={() => {
                    const next = !turnNotificationEnabled;
                    setTurnNotificationEnabled(next);
                    persistTurnNotificationEnabled(next);
                  }}
                  aria-label="Toggle turn completion notification"
                  title={`Turn notification ${turnNotificationEnabled ? "on" : "off"}`}
                >
                  <NotificationIcon enabled={turnNotificationEnabled} />
                </button>
                <button
                  className="theme-toggle icon-only"
                  type="button"
                  onClick={onToggleTheme}
                  aria-label="Toggle theme"
                  title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
                >
                  <ThemeIcon theme={theme} />
                </button>
              </div>
            </div>
            <div className="panel">
              <h3>Current Thread</h3>
              <div className="meta-line"><b>ThreadId</b></div>
              <div className="meta-value">{activeThread || sessionSummary?.active_thread_id || "-"}</div>
              <div className="meta-line"><b>Project</b></div>
              <div className="meta-value">{currentProjectLabel}</div>
              <div className="meta-line"><b>Workspace</b></div>
              <div className="meta-value">{activeProjectTab?.path || sessionSummary?.workspace || "-"}</div>
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
            <div className="panel">
              <div className="panel-head">
                <h3>Projects</h3>
              </div>
              {interactionBusy ? (
                <div className="panel-note">Project switch is unavailable while a turn is running.</div>
              ) : null}
              <div className="thread-list project-list">
                {projectItems.map((item) => (
                  <button
                    key={item.key}
                    className={`thread-item project-item ${item.key === activeProjectKey ? "active" : ""}`}
                    onClick={() => selectProject(item.key).catch(() => {})}
                    disabled={interactionBusy}
                    type="button"
                  >
                    <div className="thread-title">
                      {item.name || item.key}
                      {item.default ? <span className="project-pill">default</span> : null}
                    </div>
                    <div className="thread-sub">{item.key}</div>
                  </button>
                ))}
                {projectItems.length ? null : <div className="panel-note">No projects configured.</div>}
              </div>
            </div>
            <div className="panel threads-panel">
              <div className="panel-head">
                <h3>Threads</h3>
              </div>
              <div className="thread-list">
                {threadItems.map((item) => (
                  <button
                    key={item.id}
                    className={`thread-item ${normalizeThreadId(item.id) === normalizeThreadId(activeThread) ? "active" : ""}`}
                    onClick={() => viewThread(item.id)}
                    disabled={interactionBusy}
                    type="button"
                  >
                    <div className="thread-title">{item.title || "Untitled"}</div>
                    <div className="thread-sub">{item.id}</div>
                  </button>
                ))}
                {threadItems.length ? null : (
                  <div className="panel-note">No open threads.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}
        <div className="sidebar-footer">
          <button
            className="sidebar-collapse-btn"
            type="button"
            onClick={() => {
              if (isMobileLayout) {
                setIsSidebarOpen(false);
                return;
              }
              setIsSidebarCollapsed((current) => !current);
            }}
            aria-label={isMobileLayout ? "Collapse left panel" : isDesktopSidebarCollapsed ? "Expand left panel" : "Collapse left panel"}
            title={isMobileLayout ? "Collapse left panel" : isDesktopSidebarCollapsed ? "Expand left panel" : "Collapse left panel"}
          >
            <SidebarChevronIcon collapsed={isMobileLayout ? false : isDesktopSidebarCollapsed} />
          </button>
        </div>
      </aside>
      {isMobileLayout ? (
        <button
          className={`sidebar-backdrop ${isSidebarOpen ? "open" : ""}`}
          type="button"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close navigation menu"
        />
      ) : !isDesktopSidebarCollapsed ? (
        <div
          className={`sidebar-resizer ${isResizingSidebar ? "active" : ""}`}
          onMouseDown={() => setIsResizingSidebar(true)}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
        />
      ) : (
        <div className="sidebar-resizer sidebar-resizer-collapsed" aria-hidden="true" />
      )}
      <main className="main">
        {isMobileLayout ? (
          <div className="mobile-main-actions">
            <button
              className="menu-toggle icon-only"
              type="button"
              onClick={() => setIsSidebarOpen((current) => !current)}
              aria-label="Toggle navigation menu"
              aria-expanded={isSidebarOpen}
              aria-controls="app-sidebar"
            >
              <MenuIcon />
            </button>
          </div>
        ) : null}
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
        <div className="top-tabs">
          <div className="project-tabs-row">
            {projectTabs.map((tab) => (
              <div
                key={tab.id}
                className={`project-tab-chip ${tab.id === activeProjectTabId ? "active" : ""} state-${projectTabStatusById[tab.id] || "idle"}`}
              >
                <button
                  type="button"
                  className="project-tab-main"
                  onClick={() => {
                    setActiveProjectTabId(tab.id);
                    if (isMobileLayout) {
                      setIsSidebarOpen(false);
                    }
                  }}
                >
                  {tab.name}
                </button>
                <button
                  type="button"
                  className="project-tab-close"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeProjectTab(tab.id);
                  }}
                  aria-label={`Close project ${tab.name}`}
                  title="Close project tab"
                >
                  <CloseTabIcon />
                </button>
              </div>
            ))}
          </div>
          <div className="turn-tabs-row">
            {(threadTabsByProjectTabId[activeProjectTabId] || []).map((tab) => (
              <div
                key={tab.id}
                className={`turn-tab-chip ${normalizeThreadId(tab.id) === normalizeThreadId(activeThread) ? "active" : ""} state-${tab.status || "idle"} ${tab.hasUnreadCompletion ? "unread" : ""}`}
              >
                <button
                  type="button"
                  className="turn-tab-main"
                  onClick={() => viewThread(tab.id)}
                >
                  <span className="turn-tab-title">{tab.title || tab.id}</span>
                  {tab.hasUnreadCompletion ? <span className="turn-tab-dot" /> : null}
                </button>
                <button
                  type="button"
                  className="turn-tab-close"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeThreadTab(activeProjectTabId, tab.id);
                  }}
                  aria-label={`Close thread ${tab.title || tab.id}`}
                  title="Close thread tab"
                >
                  <CloseTabIcon />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="turn-tab-add"
              onClick={() => startThread().catch(() => {})}
              aria-label="Add thread tab"
              title="Add thread tab"
              disabled={!activeProjectKey || interactionBusy}
            >
              <AddTabIcon />
            </button>
          </div>
        </div>
        <div className="workspace-layout">
          <div className="center-pane">
            {workspacePreview ? (
              <div className={`workspace-preview-panel ${workspacePreview.mode === "diff" ? "diff-mode" : "file-mode"}`}>
                <div className="workspace-preview-head">
                  <div className="workspace-preview-copy">
                    <div className="workspace-preview-title">
                      {workspacePreview.mode === "diff" ? "Diff Preview" : "File Preview"}
                    </div>
                    <div className="workspace-preview-path">
                      {workspacePreview.status ? `[${workspacePreview.status}] ` : ""}
                      {workspacePreview.path}
                    </div>
                  </div>
                  <button
                    className="workspace-preview-close"
                    type="button"
                    onClick={() => setWorkspacePreview(null)}
                  >
                    Close
                  </button>
                </div>
                {workspacePreview.loading ? (
                  <div className="workspace-preview-empty">Loading preview...</div>
                ) : workspacePreview.error ? (
                  <div className="workspace-preview-empty">{workspacePreview.error}</div>
                ) : workspacePreview.mode === "diff" && workspacePreview.diff ? (
                  <div className="workspace-preview-body">
                    <FileChangeDiff diff={workspacePreview.diff} />
                  </div>
                ) : !workspacePreview.previewAvailable ? (
                  <div className="workspace-preview-empty">
                    {workspacePreview.isBinary ? "Binary file preview is unavailable." : "Preview is unavailable."}
                  </div>
                ) : (
                  <>
                    {workspacePreview.truncated ? (
                      <div className="workspace-preview-note">Showing the first part of the file.</div>
                    ) : null}
                    <div className="workspace-preview-body">
                      <FileCodePreview content={workspacePreview.content} />
                    </div>
                  </>
                )}
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
                      {m.turnId ? <div className="msg-meta">turnId: {m.turnId}</div> : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="composer">
              {activityDetail ? (
                <div className="activity-indicator composer-activity-indicator">{activityDetail}</div>
              ) : null}
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
                  onChange={(e) => {
                    composerFocusWantedRef.current = true;
                    rememberComposerSelection(e.currentTarget);
                    setInput(e.target.value);
                  }}
                  onFocus={(e) => {
                    composerFocusWantedRef.current = true;
                    rememberComposerSelection(e.currentTarget);
                  }}
                  onBlur={(e) => {
                    const now =
                      typeof performance !== "undefined" && typeof performance.now === "function"
                        ? performance.now()
                        : Date.now();
                    if (now - recentBackspaceAtRef.current <= 250) {
                      composerFocusWantedRef.current = true;
                      return;
                    }
                    composerFocusWantedRef.current = false;
                    rememberComposerSelection(e.currentTarget);
                  }}
                  onSelect={(e) => {
                    rememberComposerSelection(e.currentTarget);
                  }}
                  onKeyDown={(e) => {
                    if (composerLocked) {
                      return;
                    }
                    if (e.isComposing) {
                      return;
                    }
                    composerFocusWantedRef.current = true;
                    rememberComposerSelection(e.currentTarget);
                    if (e.key === "Backspace") {
                      recentBackspaceAtRef.current =
                        typeof performance !== "undefined" && typeof performance.now === "function"
                          ? performance.now()
                          : Date.now();
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
            {isCompactWorkspaceLayout ? (
              <button
                className={`composer-action composer-workspace-toggle ${isWorkspacePanelOpen ? "active" : ""}`}
                onClick={() => setIsWorkspacePanelOpen((current) => !current)}
                aria-label="Workspace files"
                title="Workspace files"
                type="button"
              >
                <FolderIcon open={isWorkspacePanelOpen} />
              </button>
            ) : null}
            <button className="composer-action composer-new-chat" onClick={startThread} aria-label="New chat" title="New chat" disabled={interactionBusy}>
              <NewChatIcon />
            </button>
          </div>
            </div>
            {isCompactWorkspaceLayout && isWorkspacePanelOpen ? workspacePanel : null}
          </div>
          {!isCompactWorkspaceLayout ? (
            <div className="workspace-panel-shell">
              <div
                className={`workspace-panel-resizer ${isResizingWorkspacePanel ? "active" : ""}`}
                onMouseDown={(event) => {
                  workspaceResizeRef.current = {
                    startX: event.clientX,
                    startWidth: workspacePanelWidth,
                  };
                  setIsResizingWorkspacePanel(true);
                }}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize workspace files panel"
              />
              {workspacePanel}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
