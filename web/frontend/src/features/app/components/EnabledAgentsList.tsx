import { SettingsIcon } from "../../common/components/Icons";
import { AGENT_CONFIG_DEFS } from "../../common/constants";

export default function EnabledAgentsList({
  agents,
  toggleAgent,
  agentConfigLoading,
  agentConfigSaving,
  openAgentSettings,
}) {
  return (
    <>
      <h3>Enabled Agents</h3>
      <div className="thread-list agent-list">
        {(agents || []).map((agent) => {
          const isConfigurable = !!AGENT_CONFIG_DEFS[agent.name];
          const isBusy = !!agentConfigLoading || !!agentConfigSaving;
          return (
            <div key={agent.name} className="agent-row">
              <button
                className={`agent-item ${agent.enabled ? "on" : "off"} ${isConfigurable ? "clickable" : "static"}`}
                onClick={() => toggleAgent(agent.name)}
                disabled={!isConfigurable || isBusy}
                type="button"
              >
                <span>{agent.name}</span>
                <span>{agent.enabled ? "enabled" : "disabled"}</span>
              </button>
              {isConfigurable ? (
                <button
                  className="agent-settings-btn"
                  onClick={() => openAgentSettings(agent.name)}
                  disabled={isBusy}
                  aria-label={`${agent.name} settings`}
                  title={`${agent.name} settings`}
                  type="button"
                >
                  <SettingsIcon />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
