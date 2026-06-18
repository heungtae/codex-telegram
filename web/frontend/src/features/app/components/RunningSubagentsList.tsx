import React, { useId, useState } from "react";

export default function RunningSubagentsList({ activeSubagents }) {
  const [isOpen, setIsOpen] = useState(true);
  const listId = useId();

  if (!activeSubagents.length) {
    return null;
  }

  return (
    <section className="running-subagents-section">
      <div className="running-subagents-head">
        <button
          type="button"
          className={`running-subagents-toggle${isOpen ? " open" : ""}`}
          onClick={() => setIsOpen((value) => !value)}
          aria-expanded={isOpen}
          aria-controls={listId}
        >
          <span className="running-subagents-title">Running Subagents</span>
          <span className="running-subagents-chevron" aria-hidden="true" />
        </button>
        <span className="running-subagents-count">{activeSubagents.length} active</span>
      </div>
      {isOpen ? (
        <div id={listId} className="running-subagents-list">
          {activeSubagents.map((subagent, index) => {
            const threadId =
              typeof subagent.thread_id === "string" ? subagent.thread_id.trim() : "";
            const name = typeof subagent.name === "string" ? subagent.name.trim() : "";
            const role = typeof subagent.role === "string" ? subagent.role.trim() : "";
            const label = name || role || "subagent";
            const secondaryRole = name && role && role !== name ? role : "";
            const status =
              typeof subagent.status === "string" && subagent.status.trim()
                ? subagent.status.trim()
                : "active";
            const parentThreadId =
              typeof subagent.parent_thread_id === "string"
                ? subagent.parent_thread_id.trim()
                : "";
            const title = threadId
              ? `thread: ${threadId}${parentThreadId ? `, parent: ${parentThreadId}` : ""}`
              : label;

            return (
              <div
                key={`${threadId || label}:${index}`}
                className="running-subagent-item"
                title={title}
              >
                <div className="running-subagent-identity">
                  <span className="running-subagent-name">{label}</span>
                  {secondaryRole ? (
                    <span className="running-subagent-role">{secondaryRole}</span>
                  ) : null}
                </div>
                <span className="running-subagent-status">
                  <span className="running-subagent-status-dot" aria-hidden="true" />
                  <span>{status}</span>
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
