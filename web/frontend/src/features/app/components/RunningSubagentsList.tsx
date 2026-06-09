export default function RunningSubagentsList({ activeSubagents }) {
  if (!activeSubagents.length) {
    return null;
  }

  return (
    <>
      <h3 style={{ marginTop: "1rem" }}>Running Subagents</h3>
      <div className="thread-list agent-list">
        {activeSubagents.map((subagent) => {
          const threadId = typeof subagent.thread_id === "string" ? subagent.thread_id : "";
          const label =
            typeof subagent.name === "string" && subagent.name.trim()
              ? subagent.name.trim()
              : typeof subagent.role === "string" && subagent.role.trim()
                ? subagent.role.trim()
                : "subagent";
          const detail =
            typeof subagent.role === "string" && subagent.role.trim()
              ? subagent.role.trim()
              : typeof subagent.status === "string" && subagent.status.trim()
                ? subagent.status.trim()
                : "active";
          const title = threadId
            ? `thread: ${threadId}${typeof subagent.parent_thread_id === "string" && subagent.parent_thread_id.trim() ? `, parent: ${subagent.parent_thread_id}` : ""}`
            : label;
          return (
            <div key={threadId || label} className="agent-row">
              <div className="agent-item static on" title={title}>
                <span>{label}</span>
                <span>{detail}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
