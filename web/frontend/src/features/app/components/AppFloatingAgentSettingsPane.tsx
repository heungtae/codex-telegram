import { formatGuardianRulesEditor } from "../../common/utils";
import FloatingGuardianSettingsPanel from "./FloatingGuardianSettingsPanel";

export default function AppFloatingAgentSettingsPane({
  activeAgentSettings,
  floatingAgentSettings,
  agentConfigs,
  agentConfigRawEditors,
  settingsBusy,
  setFloatingAgentSettings,
  setAgentConfigRawEditors,
  loadAgentConfig,
  saveAgentSettings,
  setAgentConfigError,
}) {
  const floatingAgentConfig = floatingAgentSettings ? agentConfigs[floatingAgentSettings] : null;
  const activeAgentConfig = activeAgentSettings ? agentConfigs[activeAgentSettings] : null;
  const guardianRulesEditor =
    activeAgentSettings === "guardian"
      ? (agentConfigRawEditors[activeAgentSettings] ??
        formatGuardianRulesEditor(activeAgentConfig))
      : "";

  return (
    <FloatingGuardianSettingsPanel
      visible={floatingAgentSettings === "guardian"}
      settingsBusy={settingsBusy}
      floatingAgentConfig={floatingAgentConfig}
      floatingAgentSettings={floatingAgentSettings}
      guardianRulesEditor={guardianRulesEditor}
      setFloatingAgentSettings={setFloatingAgentSettings}
      setAgentConfigRawEditors={setAgentConfigRawEditors}
      loadAgentConfig={loadAgentConfig}
      saveAgentSettings={saveAgentSettings}
      setAgentConfigError={setAgentConfigError}
    />
  );
}
