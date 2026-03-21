import { EVENT_PANEL_KINDS, GUARDIAN_RULES_TOML_FALLBACK } from "./constants";

export function formatGuardianRulesEditor(config) {
  const raw = typeof config?.rules_toml === "string" ? config.rules_toml : "";
  return raw.trim() ? raw : GUARDIAN_RULES_TOML_FALLBACK;
}

export function normalizePlanStatus(raw) {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (value === "completed") {
    return "completed";
  }
  if (value === "inprogress" || value === "in_progress" || value === "in-progress") {
    return "in_progress";
  }
  return "pending";
}

export function formatPlanChecklistText(explanation, plan) {
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

export function summarizeReasoningStatus(text) {
  const normalized = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  if (!normalized) {
    return "";
  }
  return normalized.length > 96 ? `${normalized.slice(0, 93)}...` : normalized;
}

export function formatEventPanelTitle(kind) {
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

export function formatWebSearchAction(action) {
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

export function normalizeThreadId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function normalizeWorkspacePath(value) {
  return typeof value === "string" ? value.replace(/\\/g, "/").replace(/^\/+/, "").trim() : "";
}

export function basename(value) {
  const normalized = normalizeWorkspacePath(value);
  if (!normalized) {
    return "";
  }
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

export function buildProjectTabId(projectKey) {
  return projectKey ? `project:${projectKey}` : "";
}

export function createEmptyWorkspaceState() {
  return {
    tree: {},
    expandedDirs: { "": true },
    status: { is_git: false, items: {} },
    error: "",
    preview: null,
  };
}

export function createEmptyThreadUiState() {
  return {
    input: "",
    status: "idle",
    activityDetail: "",
  };
}

export function statusClassName(code) {
  if (code === "??") {
    return "status-untracked";
  }
  if (!code) {
    return "";
  }
  return `status-${String(code).toLowerCase()}`;
}

export function statusPriority(code) {
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

export function parseDiffLineNumber(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function renderDiffRows(diffText) {
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

export function groupMessagesForRender(messages) {
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
