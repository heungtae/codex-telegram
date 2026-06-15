import React, { useId, useState } from "react";
import { RefreshIcon, SaveIcon } from "../../common/components/Icons";
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
  const [isOpen, setIsOpen] = useState(true);
  const sectionId = useId();

  if (!activeAgentDef) return null;

  const isEnabled = activeAgentConfig?.enabled ?? false;

  return (
    <section className="guardian-section">
      <div className="panel-head">
        <button
          type="button"
          className={`guardian-toggle${isOpen ? " open" : ""}`}
          onClick={() => setIsOpen((value) => !value)}
          aria-expanded={isOpen}
          aria-controls={sectionId}
        >
          <span className="guardian-toggle-label">{activeAgentDef.title}</span>
          <span className="guardian-toggle-chevron" aria-hidden="true" />
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          className={`setting-toggle${isEnabled ? " on" : ""}`}
          onClick={() => toggleAgent(activeAgentSettings)}
          disabled={settingsBusy}
          aria-label={isEnabled ? "Guardian enabled" : "Guardian disabled"}
        />
      </div>
      {isOpen ? (
        <div id={sectionId} className="guardian-settings-body">
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
              <div className="agent-settings-actions">
                <button
                  className="agent-settings-action"
                  type="button"
                  onClick={() =>
                    loadAgentConfig(activeAgentSettings, {
                      syncRulesEditor: activeAgentSettings !== "guardian",
                    }).catch((error) => {
                      setAgentConfigError(error.message || "Failed to refresh settings.");
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
                  onClick={() => saveAgentSettings(activeAgentSettings, { includeRules: false })}
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
    </section>
  );
}
