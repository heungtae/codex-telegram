import { useCallback, useMemo } from "react";
import { normalizeWorkspacePath, statusClassName } from "../../common/utils";
import { ChevronIcon, FileIcon, FolderIcon, RefreshIcon } from "../../common/components/Icons";
import {
  buildWorkspaceDirectoryStatus,
  collectCompactWorkspaceEntry,
} from "../workspaceTreeModel";

export default function WorkspacePanel({
  isCompactWorkspaceLayout,
  isWorkspacePanelOpen,
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
}) {
  const workspaceDirectoryStatus = useMemo(
    () => buildWorkspaceDirectoryStatus(workspaceStatusItems),
    [workspaceStatusItems]
  );

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
      } catch (_err) {
        showToast("Failed to copy path.", "error");
      }
    },
    [showToast]
  );

  const renderWorkspaceTree = useCallback(
    (path = "", depth = 0) => {
      const normalizedPath = normalizeWorkspacePath(path);
      const items = Array.isArray(workspaceTree[normalizedPath]) ? workspaceTree[normalizedPath] : [];
      if (!items.length && normalizedPath) {
        return null;
      }
      return items.map((item) => {
        const itemPath = normalizeWorkspacePath(item.path);
        const isDirectory = item.type === "directory";
        if (isDirectory) {
          const compactEntry = collectCompactWorkspaceEntry({
            item,
            workspaceTree,
            workspaceDirectoryStatus,
            workspaceStatusItems,
            expandedWorkspaceDirs,
          });
          const hasChildren = !!compactEntry.leafItem.has_children || compactEntry.leafChildren.length > 0;
          const isSelected = workspacePreview?.path === compactEntry.leafPath;
          return (
            <div key={compactEntry.leafPath} className="workspace-tree-node">
              <button
                type="button"
                className={`workspace-tree-item directory ${compactEntry.isExpanded ? "expanded" : ""} ${isSelected ? "selected" : ""} ${statusClassName(compactEntry.statusCode)}`}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
                title={compactEntry.leafPath}
                onClick={() => {
                  toggleWorkspaceDirectory(compactEntry.leafPath);
                }}
                onKeyDown={(event) => {
                  const ctrlKey = event.metaKey || event.ctrlKey;
                  if (ctrlKey && event.key.toLowerCase() === "c") {
                    event.preventDefault();
                    event.stopPropagation();
                    copyWorkspacePathToClipboard(compactEntry.leafPath).catch(() => {});
                  }
                }}
              >
                <span className="workspace-tree-icon caret">
                  {hasChildren ? <ChevronIcon expanded={compactEntry.isExpanded} /> : null}
                </span>
                <span className="workspace-tree-icon glyph">
                  <FolderIcon open={compactEntry.isExpanded} />
                </span>
                <span className="workspace-tree-label workspace-tree-label-compact">{compactEntry.label}</span>
                {compactEntry.statusCode ? <span className="workspace-tree-badge">{compactEntry.statusCode}</span> : null}
              </button>
              {compactEntry.isExpanded ? renderWorkspaceTree(compactEntry.leafPath, depth + compactEntry.segments.length) : null}
            </div>
          );
        }
        const statusCode = workspaceStatusItems[itemPath]?.code || "";
        const isSelected = workspacePreview?.path === itemPath;
        return (
          <div key={itemPath} className="workspace-tree-node">
            <button
              type="button"
              className={`workspace-tree-item file ${isSelected ? "selected" : ""} ${statusClassName(statusCode)}`}
              style={{ paddingLeft: `${12 + depth * 16}px` }}
              title={itemPath}
              onClick={() => {
                openWorkspaceFile(itemPath, statusCode).catch(() => {});
              }}
              onKeyDown={(event) => {
                const ctrlKey = event.metaKey || event.ctrlKey;
                if (ctrlKey && event.key.toLowerCase() === "c") {
                  event.preventDefault();
                  event.stopPropagation();
                  copyWorkspacePathToClipboard(itemPath).catch(() => {});
                }
              }}
            >
              <span className="workspace-tree-icon caret" />
              <span className="workspace-tree-icon glyph"><FileIcon /></span>
              <span className="workspace-tree-label">{item.name}</span>
              {statusCode ? <span className="workspace-tree-badge">{statusCode}</span> : null}
            </button>
          </div>
        );
      });
    },
    [
      workspaceTree,
      workspaceDirectoryStatus,
      workspaceStatusItems,
      expandedWorkspaceDirs,
      workspacePreview,
      toggleWorkspaceDirectory,
      copyWorkspacePathToClipboard,
      openWorkspaceFile,
    ]
  );

  return (
    <aside
      className={`workspace-panel ${isCompactWorkspaceLayout ? "compact" : "desktop"} ${isWorkspacePanelOpen ? "open" : ""}`}
      style={workspacePanelStyle}
    >
      <div className="workspace-panel-head">
        <div>
          <div className="workspace-panel-title">Workspace Files</div>
          <div className="workspace-panel-subtitle">{workspaceRootLabel}</div>
        </div>
        <button
          className="workspace-refresh"
          type="button"
          onClick={() => {
            refreshWorkspaceBrowser().catch((err) => {
              setWorkspaceError(err.message || "Failed to refresh workspace tree.");
            });
          }}
          aria-label="Refresh workspace browser"
          title="Refresh workspace browser"
        >
          <RefreshIcon />
        </button>
      </div>
      {workspaceError ? <div className="workspace-panel-state">{workspaceError}</div> : null}
      {!activeWorkspacePath ? <div className="workspace-panel-state">Select a workspace to browse files.</div> : null}
      {activeWorkspacePath ? (
        <div className="workspace-tree">
          {deletedWorkspaceEntries.length ? (
            <div className="workspace-tree-group">
              <div className="workspace-tree-group-label">Deleted</div>
              {deletedWorkspaceEntries.map(([path, value]) => (
                <button
                  key={`deleted:${path}`}
                  type="button"
                  className="workspace-tree-item file deleted"
                  title={path}
                  onClick={() => {
                    const status = value as { code?: string } | null;
                    openWorkspaceFile(path, status?.code || "D").catch(() => {});
                  }}
                  onKeyDown={(event) => {
                    const ctrlKey = event.metaKey || event.ctrlKey;
                    if (ctrlKey && event.key.toLowerCase() === "c") {
                      event.preventDefault();
                      event.stopPropagation();
                      copyWorkspacePathToClipboard(path).catch(() => {});
                    }
                  }}
                >
                  <span className="workspace-tree-icon caret" />
                  <span className="workspace-tree-icon glyph"><FileIcon /></span>
                  <span className="workspace-tree-label">{path}</span>
                  <span className="workspace-tree-badge">{(value as { code?: string } | null)?.code || "D"}</span>
                </button>
              ))}
            </div>
          ) : null}
          {renderWorkspaceTree("", 0)}
          {Array.isArray(workspaceTree[""]) && workspaceTree[""].length ? null : (
            <div className="workspace-panel-state">No files available.</div>
          )}
        </div>
      ) : null}
    </aside>
  );
}
