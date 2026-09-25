import CollapsibleSection from "../../common/components/CollapsibleSection";

export default function RunningSubagentsList({ activeSubagents }) {
  if (!activeSubagents.length) {
    return null;
  }

  return (
    <CollapsibleSection
      title="Running Subagents"
      defaultOpen={true}
      sectionClassName="running-subagents-section"
      headClassName="running-subagents-head"
      toggleClassName="running-subagents-toggle"
      labelClassName="running-subagents-title"
      chevronClassName="running-subagents-chevron"
      listClassName="running-subagents-list"
      headerActions={
        <span className="running-subagents-count">{activeSubagents.length} active</span>
      }
    >
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
    </CollapsibleSection>
  );
}
