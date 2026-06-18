import { RefreshIcon, SaveIcon } from "../../common/components/Icons";
import { FormField, Select } from "../../common/components/ui";
import GuardianRulesSummary from "./GuardianRulesSummary";

export default function AgentSettingsCard({
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
}) {
  if (!activeAgentDef) {
    return null;
  }

  return (
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
            <FormField
              key={field.key}
              className="agent-field"
              label={field.label}
            >
              <Select
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
              </Select>
            </FormField>
          ))}
          {activeAgentSettings === "guardian" ? (
            <GuardianRulesSummary
              guardianRuleSummary={guardianRuleSummary}
              floatingAgentSettings={floatingAgentSettings}
              toggleFloatingAgentSettings={toggleFloatingAgentSettings}
              settingsBusy={settingsBusy}
            />
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
  );
}
