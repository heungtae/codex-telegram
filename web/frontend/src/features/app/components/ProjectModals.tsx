import { Badge, Button, EmptyState, Input, Modal } from "../../common/components/ui";

export function ProjectModeModal({ isOpen, onClose, onChooseProjectClickMode }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Project open mode" title="Choose Project Tab Behavior">
      <div className="modal-desc">
        Choose whether clicking a project opens it in a new tab or replaces the current tab.
      </div>
      <div className="modal-actions">
        <Button
          type="button"
          variant="primary"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => onChooseProjectClickMode("open_new_tab")}
        >
          Open in New Tab
        </Button>
        <Button
          type="button"
          variant="secondary"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => onChooseProjectClickMode("replace_current")}
        >
          Replace Current Tab
        </Button>
        <Button
          type="button"
          variant="ghost"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </Modal>
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
  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Project picker" className="project-picker-modal">
      <div className="project-picker-search">
        <Input
          className="project-picker-input"
          placeholder="Search projects..."
          value={projectSearchQuery}
          onChange={(event) => onProjectSearchQueryChange(event.target.value)}
          autoFocus
        />
      </div>
      <div className="project-picker-list">
        {filteredProjects.length === 0 ? (
          <EmptyState className="project-picker-empty">No projects found</EmptyState>
        ) : (
          filteredProjects.map((item, idx) => (
            <button
              key={item.key}
              type="button"
              className={`project-picker-item ${idx === selectedProjectIndex ? "selected" : ""}`}
              onClick={() => onSelectProject(item.key)}
              onMouseEnter={() => onSelectedProjectIndexChange(idx)}
            >
              <span className="project-picker-name">{item.name || item.key}</span>
              {item.default ? (
                <Badge variant="accent" className="project-picker-badge">
                  default
                </Badge>
              ) : (
                <span className="project-picker-key">{item.key}</span>
              )}
            </button>
          ))
        )}
      </div>
      <div className="project-picker-footer">
        <span>
          <kbd>Up/Down</kbd> Navigate
        </span>
        <span>
          <kbd>Enter</kbd> Select
        </span>
        <span>
          <kbd>Esc</kbd> Close
        </span>
      </div>
    </Modal>
  );
}
