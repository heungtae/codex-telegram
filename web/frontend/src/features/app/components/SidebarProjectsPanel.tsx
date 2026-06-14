import { useEffect, useRef, useState } from "react";

import { IconButton } from "../../common/components/ui";
import { normalizeThreadId } from "../../common/utils";
import type { ProjectRow, ProjectSessionRow } from "../state/projectRows.js";

function ProjectBaseRowItem({ row, interactionBusy, onSelectProject }) {
  return (
    <button
      type="button"
      className="thread-item project-item project-base-row"
      onClick={() => onSelectProject(row.key)}
      disabled={interactionBusy}
      aria-label={`Open project ${row.name}`}
    >
      <div className="thread-title">
        {row.name}
        {row.isDefault ? <span className="project-pill">default</span> : null}
      </div>
      <div className="thread-sub">{row.path}</div>
    </button>
  );
}

export default function SidebarProjectsPanel({
  projectRows,
  activeThread,
  interactionBusy,
  disableAddThread,
  onSelectProject,
  onSelectProjectTab,
  onCloseProjectTab,
  onSelectThread,
  onCloseThread,
  onAddThread,
}: {
  projectRows: ProjectRow[];
  activeThread: string;
  interactionBusy: boolean;
  disableAddThread: boolean;
  onSelectProject: (key: string) => void;
  onSelectProjectTab: (projectTabId: string) => void;
  onCloseProjectTab: (projectTabId: string) => void;
  onSelectThread: (projectTabId: string, threadId: string) => void;
  onCloseThread: (projectTabId: string, threadId: string) => void;
  onAddThread: (projectTabId: string) => void;
}) {
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const row of projectRows) {
      if (row.type === "session" && row.isActive) s.add(row.projectTabId);
    }
    return s;
  });

  const knownSessionIds = useRef<Set<string>>(
    new Set(
      projectRows
        .filter((r): r is ProjectSessionRow => r.type === "session")
        .map((r) => r.projectTabId)
    )
  );

  useEffect(() => {
    const sessionRows = projectRows.filter(
      (r): r is ProjectSessionRow => r.type === "session"
    );
    const currentIds = new Set(sessionRows.map((r) => r.projectTabId));

    for (const row of sessionRows) {
      if (row.isActive && !knownSessionIds.current.has(row.projectTabId)) {
        setExpandedSessions((prev) => new Set([...prev, row.projectTabId]));
      }
    }
    setExpandedSessions((prev) => {
      const toRemove = [...prev].filter((id) => !currentIds.has(id));
      if (!toRemove.length) return prev;
      const next = new Set(prev);
      for (const id of toRemove) next.delete(id);
      return next;
    });
    knownSessionIds.current = currentIds;
  }, [projectRows]);

  const toggleExpand = (projectTabId: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(projectTabId)) {
        next.delete(projectTabId);
      } else {
        next.add(projectTabId);
      }
      return next;
    });
  };

  return (
    <section className="projects-section">
      <div className="panel-head">
        <h3>Projects</h3>
        {interactionBusy ? (
          <span className="projects-busy-note">Switch unavailable while running</span>
        ) : null}
      </div>
      <div className="project-flat-list">
        {projectRows.map((row) => {
          if (row.type === "project") {
            return (
              <ProjectBaseRowItem
                key={row.key}
                row={row}
                interactionBusy={interactionBusy}
                onSelectProject={onSelectProject}
              />
            );
          }

          const isExpanded = expandedSessions.has(row.projectTabId);
          const listId = `project-threads-${row.projectTabId.replace(/[^a-zA-Z0-9-]/g, "-")}`;

          return (
            <div
              key={row.projectTabId}
              className={`project-session-row state-${row.status}${row.isActive ? " active" : ""}`}
            >
              <div className="project-session-header">
                <button
                  type="button"
                  className="project-session-name"
                  onClick={() => onSelectProjectTab(row.projectTabId)}
                  disabled={interactionBusy}
                  aria-label={`Select project ${row.name}`}
                >
                  <span className="project-session-title">{row.name}</span>
                </button>
                <button
                  type="button"
                  className={`project-session-toggle${isExpanded ? " open" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(row.projectTabId);
                  }}
                  aria-expanded={isExpanded}
                  aria-controls={listId}
                  aria-label={isExpanded ? "Collapse threads" : "Expand threads"}
                />
                <IconButton
                  className="project-session-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseProjectTab(row.projectTabId);
                  }}
                  ariaLabel={`Close project ${row.name}`}
                  title="Close project tab"
                >
                  <img
                    className="tab-action-icon"
                    src="/assets/icons-tab-close.svg"
                    alt=""
                    aria-hidden="true"
                  />
                </IconButton>
              </div>
              {isExpanded ? (
                <div id={listId} className="project-thread-list">
                  {row.threadTabs.map((thread) => {
                    const isActiveThread =
                      normalizeThreadId(thread.id) ===
                      normalizeThreadId(activeThread as string);
                    return (
                      <div
                        key={thread.id}
                        className={`thread-tab-item${isActiveThread ? " active" : ""} state-${thread.status}${thread.hasUnreadCompletion ? " unread" : ""}`}
                      >
                        <button
                          type="button"
                          className="session-tab-main"
                          onClick={() => onSelectThread(row.projectTabId, thread.id)}
                        >
                          <span className="session-tab-title">{thread.title}</span>
                          {thread.hasUnreadCompletion ? (
                            <span className="session-tab-dot" />
                          ) : null}
                        </button>
                        <IconButton
                          className="session-tab-close"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCloseThread(row.projectTabId, thread.id);
                          }}
                          ariaLabel={`Close thread ${thread.title}`}
                          title="Close thread"
                        >
                          <img
                            className="tab-action-icon"
                            src="/assets/icons-tab-close.svg"
                            alt=""
                            aria-hidden="true"
                          />
                        </IconButton>
                      </div>
                    );
                  })}
                  {row.threadTabs.length === 0 ? (
                    <div className="panel-note">No open chats for this project.</div>
                  ) : null}
                  <IconButton
                    className="session-tab-add"
                    onClick={() => onAddThread(row.projectTabId)}
                    ariaLabel="Add new chat"
                    title="New chat"
                    disabled={disableAddThread || interactionBusy}
                  >
                    <img
                      className="tab-action-icon"
                      src="/assets/icons-tab-add.svg"
                      alt=""
                      aria-hidden="true"
                    />
                  </IconButton>
                </div>
              ) : null}
            </div>
          );
        })}
        {projectRows.length === 0 ? (
          <div className="panel-note">No projects configured.</div>
        ) : null}
      </div>
    </section>
  );
}
