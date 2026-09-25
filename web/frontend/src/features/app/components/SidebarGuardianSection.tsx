import CollapsibleSection from "../../common/components/CollapsibleSection";
import AgentSettingsActions from "./AgentSettingsActions";
import GuardianSettingDropdown from "./GuardianSettingDropdown";

export default function SidebarGuardianSection({
  activeAgentDef,
  activeAgentConfig,
  settingsBusy,
  updateAgentDraft,
  activeAgentSettings,
  loadAgentConfig,
  setAgentConfigError,
  saveAgentSettings,
  toggleAgent,
}) {
  if (!activeAgentDef) return null;

  const isGuardian = activeAgentSettings === "guardian";
  const isEnabled = activeAgentConfig?.enabled ?? false;

  return (
    <CollapsibleSection
      title={activeAgentDef.title}
      defaultOpen={true}
      sectionClassName="guardian-section"
      toggleClassName="guardian-toggle"
      labelClassName="guardian-toggle-label"
      chevronClassName="guardian-toggle-chevron"
      listClassName="guardian-settings-body"
      headerActions={
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          className={`setting-toggle${isEnabled ? " on" : ""}`}
          onClick={() => toggleAgent(activeAgentSettings)}
          disabled={settingsBusy}
          aria-label={isEnabled ? "Guardian enabled" : "Guardian disabled"}
        />
      }
    >
      {activeAgentConfig ? (
        <div className="agent-settings-form">
          {activeAgentDef.fields.map((field) => (
            <div key={field.key} className="agent-field">
              <div className="ui-form-field-label">{field.label}</div>
              <GuardianSettingDropdown
                fieldKey={field.key}
                label={field.label}
                value={activeAgentConfig[field.key] ?? ""}
                options={field.options}
                onChange={(nextValue) => {
                  const value =
                    typeof field.options[0] === "number" ? Number(nextValue) : nextValue;
                  updateAgentDraft(activeAgentSettings, field.key, value);
                }}
                disabled={settingsBusy}
              />
            </div>
          ))}
          <AgentSettingsActions
            settingsBusy={settingsBusy}
            onRefresh={() =>
              loadAgentConfig(activeAgentSettings, {
                syncRulesEditor: !isGuardian,
              }).catch((error) => {
                setAgentConfigError(error.message || "Failed to refresh settings.");
              })
            }
            onSave={() => saveAgentSettings(activeAgentSettings, { includeRules: false })}
          />
        </div>
      ) : (
        <div className="agent-settings-empty">Loading settings.</div>
      )}
    </CollapsibleSection>
  );
}
