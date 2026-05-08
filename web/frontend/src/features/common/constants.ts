export const AGENT_CONFIG_DEFS = {
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

export const THEME_STORAGE_KEY = "codex-web-theme";
export const TURN_NOTIFICATION_STORAGE_KEY = "codex-web-turn-notification-enabled";
export const DEFAULT_THEME = "dark";
export const GUARDIAN_RULES_TOML_FALLBACK = "# Loading Guardian rules...\\n";
export const EVENT_PANEL_KINDS = new Set(["file_change", "reasoning", "web_search", "image_generation"]);
