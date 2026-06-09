import { Panel } from "../../common/components/ui";
import AgentSettingsCard from "./AgentSettingsCard";
import EnabledAgentsList from "./EnabledAgentsList";
import RunningSubagentsList from "./RunningSubagentsList";

export default function SidebarAgentsPanel({
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
}) {
  return (
    <Panel>
      <EnabledAgentsList
        agents={sessionSummary?.agents || []}
        toggleAgent={toggleAgent}
        agentConfigLoading={agentConfigLoading}
        agentConfigSaving={agentConfigSaving}
        openAgentSettings={openAgentSettings}
      />
      <RunningSubagentsList activeSubagents={activeSubagents} />
      {agentConfigError ? <div className="agent-error">{agentConfigError}</div> : null}
      <AgentSettingsCard
        activeAgentDef={activeAgentDef}
        activeAgentConfig={activeAgentConfig}
        settingsBusy={settingsBusy}
        updateAgentDraft={updateAgentDraft}
        activeAgentSettings={activeAgentSettings}
        guardianRuleSummary={guardianRuleSummary}
        floatingAgentSettings={floatingAgentSettings}
        toggleFloatingAgentSettings={toggleFloatingAgentSettings}
        loadAgentConfig={loadAgentConfig}
        setAgentConfigError={setAgentConfigError}
        saveAgentSettings={saveAgentSettings}
      />
    </Panel>
  );
}
