import { useState, useEffect } from "react";
import { CloseIcon, RefreshIcon, SaveIcon } from "../../common/components/Icons";
import { FormField, Textarea } from "../../common/components/ui";

export default function FloatingGuardianSettingsPanel({
  visible,
  settingsBusy,
  floatingAgentConfig,
  floatingAgentSettings,
  guardianRulesEditor,
  setFloatingAgentSettings,
  setAgentConfigRawEditors,
  loadAgentConfig,
  saveAgentSettings,
  setAgentConfigError,
}) {
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!visible) return;
    const popover = document.querySelector(".sidebar-settings-popover") as HTMLElement | null;
    if (popover) {
      const rect = popover.getBoundingClientRect();
      setPanelStyle({
        position: "fixed",
        bottom: window.innerHeight - rect.bottom,
        left: rect.right + 16,
      });
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <div className="agent-floating-settings" style={panelStyle} onMouseDown={(e) => e.stopPropagation()}>
      <div className="agent-floating-settings-card">
        <div className="agent-settings-head">
          <strong>Guardian Rules TOML</strong>
          <button
            className="agent-floating-settings-close"
            type="button"
            onClick={() => setFloatingAgentSettings("")}
            disabled={settingsBusy}
          >
            <CloseIcon />
          </button>
        </div>
        {floatingAgentConfig ? (
          <div className="agent-settings-form">
            <FormField
              className="agent-field"
              label="Rules TOML"
              help="Only rules that already exist in `conf.toml` are active. If none are configured, commented examples from `conf.toml.example` are shown here."
              helpClassName="agent-field-help"
            >
              <Textarea
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
            </FormField>
            <div className="agent-floating-settings-note">
              Timeout, failure policy, and explainability stay in the left settings card.
            </div>
            <div className="agent-settings-actions">
              <button
                className="agent-settings-action"
                type="button"
                onClick={() =>
                  loadAgentConfig(floatingAgentSettings, { syncRulesEditor: true }).catch((err) => {
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
                onClick={() => saveAgentSettings(floatingAgentSettings, { includeRules: true })}
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
    </div>
  );
}
