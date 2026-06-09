import { EmptyState, Panel } from "../../common/components/ui";

export default function SidebarProjectsPanel({
  interactionBusy,
  projectItems,
  activeProjectKey,
  selectProject,
}) {
  return (
    <Panel>
      <div className="panel-head">
        <h3>Projects</h3>
      </div>
      {interactionBusy ? (
        <EmptyState tone="notice" className="panel-note">
          Project switch is unavailable while a turn is running.
        </EmptyState>
      ) : null}
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
        {projectItems.length ? null : (
          <EmptyState className="panel-note">No projects configured.</EmptyState>
        )}
      </div>
    </Panel>
  );
}
