import React, { useCallback, useMemo, useState } from "react";
import { basename, normalizeWorkspacePath } from "../../common/utils";
import { ExpandIcon, FileIcon, FolderIcon, PanelRightIcon, RefreshIcon } from "../../common/components/Icons";
import { EmptyState } from "../../common/components/ui";
import { buildWorkspaceDirectoryStatus, filterWorkspaceTree } from "../workspaceTreeModel";
import WorkspaceDeletedEntries from "./WorkspaceDeletedEntries";
import WorkspacePreviewPanel from "./WorkspacePreviewPanel";
import WorkspaceTree from "./WorkspaceTree";

export default function WorkspacePanel({
  isCompactWorkspaceLayout,
  isWorkspacePanelOpen,
  onToggleWorkspacePanel,
  workspacePanelStyle,
  workspaceRootLabel,
  workspaceError,
  activeWorkspacePath,
  workspaceStatusItems,
  workspaceTree,
  expandedWorkspaceDirs,
  workspacePreview,
  toggleWorkspaceDirectory,
  openWorkspaceFile,
  refreshWorkspaceBrowser,
  setWorkspaceError,
  showToast,
  isWorkspaceExpanded,
  onToggleWorkspaceExpand,
}) {
  const [filterQuery, setFilterQuery] = useState("");
  const [isStructurePanelVisible, setIsStructurePanelVisible] = useState(true);
  const workspaceDirectoryStatus = useMemo(
    () => buildWorkspaceDirectoryStatus(workspaceStatusItems),
    [workspaceStatusItems]
  );
  const visibleWorkspaceTree = useMemo(
    () => filterWorkspaceTree(workspaceTree, filterQuery),
    [workspaceTree, filterQuery]
  );
  const rootItems = Array.isArray(visibleWorkspaceTree[""]) ? visibleWorkspaceTree[""] : [];
  const activeFileLabel = basename(workspacePreview?.path || "") || "No file";

  const deletedWorkspaceEntries = useMemo(
    () =>
      Object.entries(workspaceStatusItems)
        .filter(([path, value]) => {
          const status = value as { code?: string } | null;
          return status?.code === "D" && !workspaceTree[""]?.some((item) => item.path === path);
        })
        .sort((a, b) => a[0].localeCompare(b[0])),
    [workspaceStatusItems, workspaceTree]
  );

  const copyWorkspacePathToClipboard = useCallback(
    async (path) => {
      const text = normalizeWorkspacePath(path);
      if (!text) {
        return;
      }
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.setAttribute("readonly", "true");
          textarea.style.position = "fixed";
          textarea.style.left = "-9999px";
          textarea.style.top = "-9999px";
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }
        showToast(`Copied ${text}`, "success");
      } catch {
        showToast("Failed to copy path.", "error");
      }
    },
    [showToast]
  );

  return (
    <aside
      className={`workspace-panel ${isCompactWorkspaceLayout ? "compact" : "desktop"} ${isWorkspacePanelOpen ? "open" : ""}`}
      style={workspacePanelStyle}
    >
      <div className="workspace-sidebar-topbar">
        <div className="workspace-file-tabs" aria-label="Workspace file tabs">
          <div
            className={`workspace-file-tab ${workspacePreview ? "active" : ""}`}
            title={workspacePreview?.path || "No file selected"}
          >
            <span className="workspace-file-tab-icon"><FileIcon /></span>
            <span className="workspace-file-tab-label">{activeFileLabel}</span>
          </div>
        </div>
        {!isCompactWorkspaceLayout ? (
          <button
            className="workspace-panel-collapse"
            type="button"
            onClick={onToggleWorkspacePanel}
            aria-label="Collapse workspace panel"
            title="Collapse workspace panel"
          >
            <PanelRightIcon />
          </button>
        ) : null}
      </div>
      <div className="workspace-unified-head">
        <div className="workspace-unified-head-path">
          {workspacePreview ? (
            <>
              {workspacePreview.status ? `[${workspacePreview.status}] ` : ""}
              {workspacePreview.path}
            </>
          ) : null}
        </div>
        <div className="workspace-unified-head-actions">
          <button
            className={`workspace-unified-action workspace-unified-toggle-structure ${isStructurePanelVisible ? "active" : ""}`}
            type="button"
            onClick={() => setIsStructurePanelVisible((value) => !value)}
            aria-label={isStructurePanelVisible ? "Hide project structure" : "Show project structure"}
            title={isStructurePanelVisible ? "Hide project structure" : "Show project structure"}
          >
            <FolderIcon open={isStructurePanelVisible} />
          </button>
          <button
            className="workspace-unified-action workspace-unified-expand"
            type="button"
            onClick={onToggleWorkspaceExpand}
            aria-label={isWorkspaceExpanded ? "Restore workspace panel" : "Expand workspace panel"}
            title={isWorkspaceExpanded ? "Restore workspace panel" : "Expand workspace panel"}
          >
            <ExpandIcon expanded={isWorkspaceExpanded} />
          </button>
          <button
            className="workspace-unified-action workspace-unified-refresh"
            type="button"
            onClick={() => {
              setWorkspaceError("");
              refreshWorkspaceBrowser().catch((err) => {
                setWorkspaceError(err.message || "Failed to refresh workspace.");
              });
            }}
            aria-label="Refresh workspace browser"
            title="Refresh workspace browser"
          >
            <RefreshIcon />
          </button>
        </div>
      </div>
      <div className="workspace-sidebar-body">
        <section className="workspace-file-viewer workspace-preview-pane" aria-label="Current file preview">
          {workspacePreview ? (
            <WorkspacePreviewPanel
              workspacePreview={workspacePreview}
              inline
              className="workspace-preview-inline"
            />
          ) : (
            <EmptyState tone="notice" className="workspace-preview-empty">
              Select a file to preview.
            </EmptyState>
          )}
        </section>
        {isStructurePanelVisible ? (
        <section className="workspace-structure-panel" aria-label="Project structure">
          <div className="workspace-filter-wrap">
            <input
              className="workspace-filter-input"
              type="search"
              placeholder="Filter files..."
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              aria-label="Filter workspace files"
            />
          </div>
          {workspaceError ? <div className="workspace-panel-state">{workspaceError}</div> : null}
          {!activeWorkspacePath ? (
            <EmptyState tone="notice" className="workspace-panel-state">
              Select a workspace to browse files.
            </EmptyState>
          ) : null}
          {activeWorkspacePath ? (
            <div className="workspace-tree">
              <WorkspaceDeletedEntries
                deletedWorkspaceEntries={deletedWorkspaceEntries}
                openWorkspaceFile={openWorkspaceFile}
                copyWorkspacePathToClipboard={copyWorkspacePathToClipboard}
              />
              <WorkspaceTree
                workspaceTree={visibleWorkspaceTree}
                workspaceDirectoryStatus={workspaceDirectoryStatus}
                workspaceStatusItems={workspaceStatusItems}
                expandedWorkspaceDirs={expandedWorkspaceDirs}
                workspacePreview={workspacePreview}
                toggleWorkspaceDirectory={toggleWorkspaceDirectory}
                openWorkspaceFile={openWorkspaceFile}
                copyWorkspacePathToClipboard={copyWorkspacePathToClipboard}
              />
              {rootItems.length ? null : (
                <EmptyState className="workspace-panel-state">
                  {filterQuery.trim() ? "No files match this filter." : "No files available."}
                </EmptyState>
              )}
            </div>
          ) : null}
        </section>
        ) : null}
      </div>
    </aside>
  );
}
