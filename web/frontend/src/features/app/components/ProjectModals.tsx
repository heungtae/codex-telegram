import React from "react";
import { Badge, Button, EmptyState, Input, Modal } from "../../common/components/ui";
import { api } from "../../../shared/api/httpClient";

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

export function AddProjectModal({ isOpen, onClose, onAddProject, project = null }) {
  const [key, setKey] = React.useState(project?.key || "");
  const [name, setName] = React.useState(project?.name || "");
  const [path, setPath] = React.useState(project?.path || "");
  const [makeDefault, setMakeDefault] = React.useState(!!project?.default);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api(project ? `/api/projects/${encodeURIComponent(project.key)}` : "/api/projects", {
        method: project ? "PUT" : "POST",
        body: JSON.stringify({ key, name, path, default: makeDefault }),
      });
      await onAddProject();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel={project ? "Modify project" : "Add project"} title={project ? "Modify Project" : "Add Project"}>
      <form onSubmit={handleSubmit}>
        <div className="modal-field">
          <label htmlFor="project-key">Key</label>
          <Input
            id="project-key"
            className="add-project-input"
            placeholder="my-project"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={loading}
            readOnly={!!project}
            autoFocus
            required
          />
          <span className="modal-hint">Letters, numbers, underscore, hyphen only</span>
        </div>
        <div className="modal-field">
          <label htmlFor="project-name">Name</label>
          <Input
            id="project-name"
            className="add-project-input"
            placeholder="My Project"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        <div className="modal-field">
          <label htmlFor="project-path">Path</label>
          <Input
            id="project-path"
            className="add-project-input"
            placeholder="/absolute/path/to/project"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        <div className="modal-field">
          <label>
            <input type="checkbox" checked={makeDefault} disabled={loading || !!project?.default}
              onChange={(event) => setMakeDefault(event.target.checked)} />
            {" "}Default project
          </label>
          {project?.default && <span className="modal-hint">Set another project as default to change this.</span>}
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "Saving..." : project ? "Save Changes" : "Add Project"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
