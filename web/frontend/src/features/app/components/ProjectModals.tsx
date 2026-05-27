export function ProjectModeModal({ isOpen, onClose, onChooseProjectClickMode }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Project open mode"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-title">Choose Project Tab Behavior</div>
        <div className="modal-desc">
          Choose whether clicking a project opens it in a new tab or replaces the current tab.
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="primary"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => onChooseProjectClickMode("open_new_tab")}
          >
            Open in New Tab
          </button>
          <button
            type="button"
            className="secondary"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => onChooseProjectClickMode("replace_current")}
          >
            Replace Current Tab
          </button>
          <button
            type="button"
            className="ghost"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectPickerModal({
  isOpen,
  projectSearchQuery,
  onProjectSearchQueryChange,
  filteredProjects,
  selectedProjectIndex,
  onSelectedProjectIndexChange,
  onSelectProject,
  onClose,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal-card project-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Project picker"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="project-picker-search">
          <input
            type="text"
            className="project-picker-input"
            placeholder="Search projects..."
            value={projectSearchQuery}
            onChange={(event) => onProjectSearchQueryChange(event.target.value)}
            autoFocus
          />
        </div>
        <div className="project-picker-list">
          {filteredProjects.length === 0 ? (
            <div className="project-picker-empty">No projects found</div>
          ) : (
            filteredProjects.map((item, idx) => (
              <button
                key={item.key}
                className={`project-picker-item ${idx === selectedProjectIndex ? "selected" : ""}`}
                onClick={() => onSelectProject(item.key)}
                onMouseEnter={() => onSelectedProjectIndexChange(idx)}
              >
                <span className="project-picker-name">{item.name || item.key}</span>
                <span className="project-picker-key">{item.key}</span>
                {item.default ? <span className="project-picker-badge">default</span> : null}
              </button>
            ))
          )}
        </div>
        <div className="project-picker-footer">
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Select</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
