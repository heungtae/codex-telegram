import React, { useEffect, useRef, useState } from "react";
import { basename } from "../../common/utils";
import { ExpandIcon, FileIcon, FolderIcon, PanelRightIcon, RefreshIcon } from "../../common/components/Icons";
import { EmptyState } from "../../common/components/ui";
import useClipboard from "../hooks/useClipboard";
import useWorkspaceFilter from "../hooks/useWorkspaceFilter";
import WorkspaceDeletedEntries from "./WorkspaceDeletedEntries";
import WorkspacePreviewPanel from "./WorkspacePreviewPanel";
import WorkspaceTree from "./WorkspaceTree";
import {
  clampWorkspaceTreeWidth,
  maxWorkspaceTreeWidth,
  WORKSPACE_SPLIT_MIN_PANE_WIDTH,
} from "../workspaceSplitSizing";

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
  const [isStructurePanelVisible, setIsStructurePanelVisible] = useState(true);
  const [structurePanelWidth, setStructurePanelWidth] = useState(240);
  const [sidebarBodyWidth, setSidebarBodyWidth] = useState(520);
  const [isResizingStructure, setIsResizingStructure] = useState(false);
  const sidebarBodyRef = useRef<HTMLDivElement>(null);
  const structurePanelRef = useRef<HTMLElement>(null);
  const structureResizeRef = useRef({ startX: 0, startWidth: 240 });
  useEffect(() => {
    const body = sidebarBodyRef.current;
    if (!body) return;
    const updateWidth = () => {
      const width = body.clientWidth;
      if (width <= 0) return;
      setSidebarBodyWidth(width);
      setStructurePanelWidth((current) => clampWorkspaceTreeWidth(current, width));
    };
    updateWidth();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateWidth);
    observer.observe(body);
    return () => observer.disconnect();
  }, []);
  const resizeStructurePanel = (width: number) => {
    const containerWidth = sidebarBodyRef.current?.clientWidth || 0;
    if (containerWidth > 0) {
      setStructurePanelWidth(clampWorkspaceTreeWidth(width, containerWidth));
    }
  };
  const { filterQuery, setFilterQuery, workspaceDirectoryStatus, visibleWorkspaceTree, rootItems, deletedWorkspaceEntries } =
    useWorkspaceFilter(workspaceTree, workspaceStatusItems);
  const copyWorkspacePathToClipboard = useClipboard(showToast);
  const activeFileLabel = basename(workspacePreview?.path || "") || "No file";

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
      <div className="workspace-sidebar-body" ref={sidebarBodyRef}>
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
        <>
        <div
          className={`workspace-structure-resizer${isResizingStructure ? " active" : ""}`}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize file preview and project structure"
          aria-valuemin={WORKSPACE_SPLIT_MIN_PANE_WIDTH}
          aria-valuemax={maxWorkspaceTreeWidth(sidebarBodyWidth)}
          aria-valuenow={Math.round(structurePanelWidth)}
          tabIndex={0}
          onPointerDown={(event) => {
            if (event.button !== 0 || !structurePanelRef.current) return;
            event.preventDefault();
            structureResizeRef.current = {
              startX: event.clientX,
              startWidth: structurePanelRef.current.getBoundingClientRect().width,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
            setIsResizingStructure(true);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            const { startX, startWidth } = structureResizeRef.current;
            resizeStructurePanel(startWidth + startX - event.clientX);
          }}
          onPointerUp={() => setIsResizingStructure(false)}
          onPointerCancel={() => setIsResizingStructure(false)}
          onLostPointerCapture={() => setIsResizingStructure(false)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const currentWidth = structurePanelRef.current?.getBoundingClientRect().width || structurePanelWidth;
            resizeStructurePanel(currentWidth + (event.key === "ArrowLeft" ? 20 : -20));
          }}
        />
        <section
          className="workspace-structure-panel"
          aria-label="Project structure"
          ref={structurePanelRef}
          style={{ width: structurePanelWidth }}
        >
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
        </>
        ) : null}
      </div>
    </aside>
  );
}
