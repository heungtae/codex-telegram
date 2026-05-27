export default function SidebarProjectsPanel({
  interactionBusy,
  projectItems,
  activeProjectKey,
  selectProject,
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Projects</h3>
      </div>
      {interactionBusy ? <div className="panel-note">Project switch is unavailable while a turn is running.</div> : null}
      <div className="thread-list project-list">
        {projectItems.map((item) => (
          <button
            key={item.key}
            className={`thread-item project-item ${item.key === activeProjectKey ? "active" : ""}`}
            onClick={() => selectProject(item.key).catch(() => {})}
            disabled={interactionBusy}
            type="button"
          >
            <div className="thread-title">
              {item.name || item.key}
              {item.default ? <span className="project-pill">default</span> : null}
            </div>
            <div className="thread-sub">{item.key}</div>
          </button>
        ))}
        {projectItems.length ? null : <div className="panel-note">No projects configured.</div>}
      </div>
    </div>
  );
}
