import { SettingsIcon, RefreshIcon, SaveIcon, NotificationIcon, ThemeIcon } from "../../common/components/Icons";
import { AGENT_CONFIG_DEFS } from "../../common/constants";
import { normalizeThreadId } from "../../common/utils";

export default function AppSidebarContentPanel({
  turnNotificationEnabled,
  setTurnNotificationEnabled,
  persistTurnNotificationEnabled,
  onToggleTheme,
  theme,
  sessionSummary,
  toggleAgent,
  agentConfigLoading,
  agentConfigSaving,
  openAgentSettings,
  activeSubagents,
  agentConfigError,
  activeAgentDef,
  activeAgentConfig,
  settingsBusy,
  updateAgentDraft,
  activeAgentSettings,
  guardianRuleSummary,
  floatingAgentSettings,
  toggleFloatingAgentSettings,
  loadAgentConfig,
  setAgentConfigError,
  saveAgentSettings,
  interactionBusy,
  projectItems,
  activeProjectKey,
  selectProject,
  threadItems,
  activeThread,
  viewThread,
}) {
  return (
    <>
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
                  aria-label={`${agent.name} settings`}
                  title={`${agent.name} settings`}
                  type="button"
                >
                  <SettingsIcon />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {activeSubagents.length ? (
          <>
            <h3 style={{ marginTop: "1rem" }}>Running Subagents</h3>
            <div className="thread-list agent-list">
              {activeSubagents.map((subagent) => {
                const threadId = typeof subagent.thread_id === "string" ? subagent.thread_id : "";
                const label =
                  typeof subagent.name === "string" && subagent.name.trim()
                    ? subagent.name.trim()
                    : typeof subagent.role === "string" && subagent.role.trim()
                      ? subagent.role.trim()
                      : "subagent";
                const detail =
                  typeof subagent.role === "string" && subagent.role.trim()
                    ? subagent.role.trim()
                    : typeof subagent.status === "string" && subagent.status.trim()
                      ? subagent.status.trim()
                      : "active";
                const title = threadId
                  ? `thread: ${threadId}${typeof subagent.parent_thread_id === "string" && subagent.parent_thread_id.trim() ? `, parent: ${subagent.parent_thread_id}` : ""}`
                  : label;
                return (
                  <div key={threadId || label} className="agent-row">
                    <div className="agent-item static on" title={title}>
                      <span>{label}</span>
                      <span>{detail}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
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
                            <span>{`${rule.action || "deny"} 쨌 p${rule.priority || 0}`}</span>
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
                    aria-label="Refresh"
                    title="Refresh"
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
                    aria-label="Save"
                    title="Save"
                  >
                    <SaveIcon />
                  </button>
                </div>
              </div>
            ) : (
              <div className="agent-settings-empty">Loading settings.</div>
            )}
          </div>
        ) : null}
      </div>
      <div className="panel">
        <div className="panel-head">
          <h3>Projects</h3>
        </div>
        {interactionBusy ? <div className="panel-note">Project switch is unavailable while a turn is running.</div> : null}
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
          {threadItems.length ? null : <div className="panel-note">No open threads.</div>}
        </div>
      </div>
    </>
  );
}
