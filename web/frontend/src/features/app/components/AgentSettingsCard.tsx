import { FormField, Select } from "../../common/components/ui";
import AgentSettingsActions from "./AgentSettingsActions";
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

  const isGuardian = activeAgentSettings === "guardian";

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
          {isGuardian ? (
            <GuardianRulesSummary
              guardianRuleSummary={guardianRuleSummary}
              floatingAgentSettings={floatingAgentSettings}
              toggleFloatingAgentSettings={toggleFloatingAgentSettings}
              settingsBusy={settingsBusy}
            />
          ) : null}
          <AgentSettingsActions
            settingsBusy={settingsBusy}
            onRefresh={() =>
              loadAgentConfig(activeAgentSettings, {
                syncRulesEditor: !isGuardian,
              }).catch((err) => {
                setAgentConfigError(err.message || "Failed to refresh settings.");
              })
            }
            onSave={() => saveAgentSettings(activeAgentSettings, { includeRules: false })}
          />
        </div>
      ) : (
        <div className="agent-settings-empty">Loading settings.</div>
      )}
    </div>
  );
}
