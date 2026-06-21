import { useEffect, useId, useRef, useState } from "react";

import { ChevronIcon, CloseIcon, ComposeIcon, FolderIcon, MoreIcon } from "../../common/components/Icons";
import { IconButton } from "../../common/components/ui";
import { normalizeThreadId } from "../../common/utils";
import { createOpenExplorerPayload } from "../state/projectExplorer.js";
import type { ProjectRow, ProjectSessionRow } from "../state/projectRows.js";

function ProjectBaseRowItem({ row, interactionBusy, onSelectProject, onMoreClick }) {
  return (
    <div className="project-flat-item">
      <div className="project-name-group">
        <button
          type="button"
          className="project-base-name"
          onClick={() => onSelectProject(row.key)}
          disabled={interactionBusy}
          aria-label={`Open project ${row.name}`}
        >
          <FolderIcon open={false} />
          <span className="project-name-text">{row.name}</span>
          {row.isDefault ? <span className="project-badge-d">D</span> : null}
        </button>
      </div>
      <IconButton
        className="project-action-btn"
        ariaLabel="More options"
        title="More options"
        onClick={(e) => onMoreClick(e, row.key, row.key)}
      >
        <MoreIcon />
      </IconButton>
      <IconButton
        className="project-action-btn"
        onClick={() => onSelectProject(row.key)}
        ariaLabel="New chat"
        title="New chat"
        disabled={interactionBusy}
      >
        <ComposeIcon />
      </IconButton>
    </div>
  );
}

export default function SidebarProjectsPanel({
  projectRows,
  activeThread,
  telegramActiveThreadId,
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
  telegramActiveThreadId: string;
  interactionBusy: boolean;
  disableAddThread: boolean;
  onSelectProject: (key: string) => void;
  onSelectProjectTab: (projectTabId: string) => void;
  onCloseProjectTab: (projectTabId: string) => void;
  onSelectThread: (projectTabId: string, threadId: string) => void;
  onCloseThread: (projectTabId: string, threadId: string) => void;
  onAddThread: (projectTabId: string) => void;
}) {
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);
  const projectsListId = useId();

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

  const prevSessionKeysRef = useRef<Record<string, string>>(
    Object.fromEntries(
      projectRows
        .filter((r): r is ProjectSessionRow => r.type === "session")
        .map((r) => [r.projectTabId, r.key])
    )
  );
  const [xButtonSessions, setXButtonSessions] = useState<Set<string>>(new Set());

  // Context menu state
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [menuProjectKey, setMenuProjectKey] = useState<string>("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sessionRows = projectRows.filter(
      (r): r is ProjectSessionRow => r.type === "session"
    );
    const currentIds = new Set(sessionRows.map((r) => r.projectTabId));

    const toAdd: string[] = [];
    for (const row of sessionRows) {
      const isNew = !knownSessionIds.current.has(row.projectTabId);
      const keyChanged = !isNew && prevSessionKeysRef.current[row.projectTabId] !== row.key;
      if (isNew || keyChanged) toAdd.push(row.projectTabId);
      prevSessionKeysRef.current[row.projectTabId] = row.key;
      if (row.isActive && isNew) {
        setExpandedSessions((prev) => new Set([...prev, row.projectTabId]));
      }
    }
    if (toAdd.length > 0) {
      setXButtonSessions((prev) => new Set([...prev, ...toAdd]));
    }
    setXButtonSessions((prev) => {
      const toRemove = [...prev].filter((id) => !currentIds.has(id));
      if (!toRemove.length) return prev;
      const next = new Set(prev);
      for (const id of toRemove) next.delete(id);
      return next;
    });
    setExpandedSessions((prev) => {
      const toRemove = [...prev].filter((id) => !currentIds.has(id));
      if (!toRemove.length) return prev;
      const next = new Set(prev);
      for (const id of toRemove) next.delete(id);
      return next;
    });
    Object.keys(prevSessionKeysRef.current).forEach((id) => {
      if (!currentIds.has(id)) delete prevSessionKeysRef.current[id];
    });
    knownSessionIds.current = currentIds;
  }, [projectRows]);

  const handleCloseProjectTab = (projectTabId: string) => {
    onCloseProjectTab(projectTabId);
    setXButtonSessions((prev) => {
      const next = new Set(prev);
      next.delete(projectTabId);
      return next;
    });
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      next.delete(projectTabId);
      return next;
    });
  };

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

  useEffect(() => {
    if (!openMenuKey) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuKey(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuKey]);

  useEffect(() => {
    if (!openMenuKey) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuKey(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [openMenuKey]);

  const handleMoreClick = (e: React.MouseEvent, menuKey: string, projectKey: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPosition({ top: rect.bottom + 4, left: rect.left });
    setMenuProjectKey(projectKey);
    setOpenMenuKey((prev) => (prev === menuKey ? null : menuKey));
  };

  const handleOpenInExplorer = () => {
    if (!menuProjectKey) return;
    setOpenMenuKey(null);
    fetch("/api/projects/open-explorer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createOpenExplorerPayload(menuProjectKey)),
    }).catch(() => {});
  };

  return (
    <>
      <section className="projects-section">
        <div className="panel-head">
          <button
            type="button"
            className={`projects-toggle${isProjectsExpanded ? " open" : ""}`}
            onClick={() => setIsProjectsExpanded((v) => !v)}
            aria-expanded={isProjectsExpanded}
            aria-controls={projectsListId}
          >
            <span className="projects-toggle-label">Projects</span>
            <span className="projects-toggle-chevron"><ChevronIcon expanded={isProjectsExpanded} /></span>
          </button>
          {interactionBusy ? (
            <span className="projects-busy-note">Switch unavailable while running</span>
          ) : null}
        </div>
        {isProjectsExpanded ? (
        <div id={projectsListId} className="project-flat-list">
          {projectRows.map((row) => {
            if (row.type === "project") {
              return (
                <ProjectBaseRowItem
                  key={row.key}
                  row={row}
                  interactionBusy={interactionBusy}
                  onSelectProject={onSelectProject}
                  onMoreClick={handleMoreClick}
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
                  <div className="project-name-group">
                    <button
                      type="button"
                      className="project-session-name"
                      onClick={() => onSelectProjectTab(row.projectTabId)}
                      disabled={interactionBusy}
                      aria-label={`Select project ${row.name}`}
                    >
                      <FolderIcon open={false} />
                      <span className="project-session-title">{row.name}</span>
                      {row.isDefault ? <span className="project-badge-d">D</span> : null}
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
                    >
                      <ChevronIcon expanded={isExpanded} />
                    </button>
                  </div>
                  <IconButton
                    className="project-action-btn"
                    ariaLabel="More options"
                    title="More options"
                    onClick={(e) => handleMoreClick(e, row.projectTabId, row.key)}
                  >
                    <MoreIcon />
                  </IconButton>
                  <IconButton
                    className="project-action-btn"
                    onClick={() => onAddThread(row.projectTabId)}
                    ariaLabel="New chat"
                    title="New chat"
                    disabled={interactionBusy || disableAddThread}
                  >
                    <ComposeIcon />
                  </IconButton>
                  {!row.isDefault && xButtonSessions.has(row.projectTabId) ? (
                    <IconButton
                      className="project-action-btn"
                      onClick={() => handleCloseProjectTab(row.projectTabId)}
                      ariaLabel="Close project"
                      title="Close project"
                    >
                      <CloseIcon />
                    </IconButton>
                  ) : null}
                </div>
                {isExpanded ? (
                  <div id={listId} className="project-thread-list">
                    {row.threadTabs.map((thread) => {
                      const isActiveThread =
                        normalizeThreadId(thread.id) ===
                        normalizeThreadId(activeThread as string);
                      const isTelegramThread =
                        normalizeThreadId(thread.id) ===
                        normalizeThreadId(telegramActiveThreadId);
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
                            {isTelegramThread ? (
                              <span
                                className="telegram-thread-badge"
                                title="Connected to Telegram"
                                aria-label="Connected to Telegram"
                              >
                                T
                              </span>
                            ) : null}
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
                            <CloseIcon />
                          </IconButton>
                        </div>
                      );
                    })}
                    {row.threadTabs.length === 0 ? (
                      <div className="panel-note">No open chats for this project.</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          {projectRows.length === 0 ? (
            <div className="panel-note">No projects configured.</div>
          ) : null}
        </div>
        ) : null}
      </section>

      {openMenuKey && menuPosition ? (
        <div
          ref={menuRef}
          className="project-context-menu"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <button
            type="button"
            className="project-context-menu-item"
            onClick={handleOpenInExplorer}
          >
            <FolderIcon open={true} />
            <span>Open in Explorer</span>
          </button>
        </div>
      ) : null}
    </>
  );
}
