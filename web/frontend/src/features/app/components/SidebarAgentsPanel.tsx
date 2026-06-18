import React, { useEffect } from "react";
import EnabledAgentsList from "./EnabledAgentsList";
import GuardianRulesSummary from "./GuardianRulesSummary";
import RunningSubagentsList from "./RunningSubagentsList";
import SidebarGuardianSection from "./SidebarGuardianSection";

export default function SidebarAgentsPanel({
  sessionSummary,
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
  toggleAgent,
}) {
  useEffect(() => {
    const agents = sessionSummary?.agents || [];
    const hasGuardian = agents.some((a) => a.name === "guardian");
    if (hasGuardian && !activeAgentSettings) {
      openAgentSettings("guardian");
    }
  }, [sessionSummary, activeAgentSettings, openAgentSettings]);

  const agents = sessionSummary?.agents || [];

  return (
    <div className="sidebar-agents-panel">
      {/* <EnabledAgentsList agents={agents} /> */}
      <RunningSubagentsList activeSubagents={activeSubagents} />
      {agentConfigError ? <div className="agent-error">{agentConfigError}</div> : null}
      <SidebarGuardianSection
        activeAgentDef={activeAgentDef}
        activeAgentConfig={activeAgentConfig}
        settingsBusy={settingsBusy}
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
        settingsBusy={settingsBusy}
      />
    </div>
  );
}
