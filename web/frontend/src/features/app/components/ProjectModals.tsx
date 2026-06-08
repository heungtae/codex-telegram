import { Badge, Button, Input, Modal } from "../../common/components/ui";

export function ProjectModeModal({ isOpen, onClose, onChooseProjectClickMode }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Project open mode">
      <div className="modal-title">Choose Project Tab Behavior</div>
      <div className="modal-desc">
        Choose whether clicking a project opens it in a new tab or replaces the current tab.
      </div>
      <div className="modal-actions">
        <Button
          variant="primary"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => onChooseProjectClickMode("open_new_tab")}
        >
          Open in New Tab
        </Button>
        <Button
          variant="secondary"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => onChooseProjectClickMode("replace_current")}
        >
          Replace Current Tab
        </Button>
        <Button
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
              {item.default ? (
                <Badge variant="accent" className="project-picker-badge">
                  default
                </Badge>
              ) : null}
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
