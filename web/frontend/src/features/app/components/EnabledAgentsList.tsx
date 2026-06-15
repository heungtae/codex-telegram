import React from "react";

export default function EnabledAgentsList({ agents }) {
  if (!agents || agents.length === 0) return null;

  return (
    <div className="thread-list agent-list enabled-agents-list">
      {agents.map((agent) => (
        <div key={agent.name} className="agent-row">
          <div className={`agent-item static ${agent.enabled ? "on" : "off"}`}>
            <span>{agent.name}</span>
            <span>{agent.enabled ? "enabled" : "disabled"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
