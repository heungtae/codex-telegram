import GuardianRulesSummary from "./GuardianRulesSummary";
import RunningSubagentsList from "./RunningSubagentsList";
import SidebarGuardianSection from "./SidebarGuardianSection";

export default function SidebarAgentsPanel({
  activeSubagents,
  agentConfigError,
  activeAgentDef,
  activeAgentConfig,
  settingsBusy,
  agentConfigLoading,
  agentConfigSaving,
  updateAgentDraft,
  activeAgentSettings,
  guardianRuleSummary,
  floatingAgentSettings,
  toggleFloatingAgentSettings,
  loadAgentConfig,
  setAgentConfigError,
  saveAgentSettings,
  toggleAgent,
}) {
  void agentConfigLoading;
  const effectiveBusy = settingsBusy || agentConfigSaving;

  return (
    <div className="sidebar-agents-panel">
      <RunningSubagentsList activeSubagents={activeSubagents} />
      {agentConfigError ? <div className="agent-error">{agentConfigError}</div> : null}
      <SidebarGuardianSection
        activeAgentDef={activeAgentDef}
        activeAgentConfig={activeAgentConfig}
        settingsBusy={effectiveBusy}
        updateAgentDraft={updateAgentDraft}
        activeAgentSettings={activeAgentSettings}
        loadAgentConfig={loadAgentConfig}
        setAgentConfigError={setAgentConfigError}
        saveAgentSettings={saveAgentSettings}
        toggleAgent={toggleAgent}
      />
      <GuardianRulesSummary
        guardianRuleSummary={guardianRuleSummary}
        floatingAgentSettings={floatingAgentSettings}
        toggleFloatingAgentSettings={toggleFloatingAgentSettings}
        settingsBusy={effectiveBusy}
      />
    </div>
  );
}
