import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useClickOutsideAndEscape } from "../../common/hooks/useClickOutsideAndEscape";

import CollapsibleSection from "../../common/components/CollapsibleSection";
import { ChevronIcon, CloseIcon, ComposeIcon, FolderIcon, MoreIcon } from "../../common/components/Icons";
import { IconButton } from "../../common/components/ui";
import { normalizeThreadId } from "../../common/utils";
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
        aria-label="More options"
        title="More options"
        onClick={(e) => onMoreClick(e, row.key, row.key)}
      >
        <MoreIcon />
      </IconButton>
      <IconButton
        className="project-action-btn"
        onClick={() => onSelectProject(row.key)}
        aria-label="New chat"
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
  onOpenInExplorer,
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
  onOpenInExplorer: (projectKey: string) => void;
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

  useClickOutsideAndEscape(menuRef, () => setOpenMenuKey(null), !!openMenuKey);

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
    onOpenInExplorer(menuProjectKey);
  };

  return (
    <>
      <CollapsibleSection
        title="Projects"
        defaultOpen={true}
        sectionClassName="projects-section"
        toggleClassName="projects-toggle"
        labelClassName="projects-toggle-label"
        chevronClassName="projects-toggle-chevron"
        listClassName="project-flat-list"
        headerActions={
          interactionBusy ? (
            <span className="projects-busy-note">Switch unavailable while running</span>
          ) : null
        }
      >
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
                    aria-label="More options"
                    title="More options"
                    onClick={(e) => handleMoreClick(e, row.projectTabId, row.key)}
                  >
                    <MoreIcon />
                  </IconButton>
                  <IconButton
                    className="project-action-btn"
                    onClick={() => onAddThread(row.projectTabId)}
                    aria-label="New chat"
                    title="New chat"
                    disabled={interactionBusy || disableAddThread}
                  >
                    <ComposeIcon />
                  </IconButton>
                  {!row.isDefault && xButtonSessions.has(row.projectTabId) ? (
                    <IconButton
                      className="project-action-btn"
                      onClick={() => handleCloseProjectTab(row.projectTabId)}
                      aria-label="Close project"
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
                            aria-label={`Close thread ${thread.title}`}
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
      </CollapsibleSection>

      {openMenuKey && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              className="project-context-menu"
              style={{ position: "fixed", top: menuPosition.top, left: menuPosition.left }}
            >
              <button
                type="button"
                className="project-context-menu-item"
                onClick={handleOpenInExplorer}
              >
                <FolderIcon open={true} />
                <span>Open in Explorer</span>
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
