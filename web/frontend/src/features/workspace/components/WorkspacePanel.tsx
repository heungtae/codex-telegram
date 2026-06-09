import { useCallback, useMemo } from "react";
import { normalizeWorkspacePath } from "../../common/utils";
import { EmptyState } from "../../common/components/ui";
import { buildWorkspaceDirectoryStatus } from "../workspaceTreeModel";
import WorkspaceDeletedEntries from "./WorkspaceDeletedEntries";
import WorkspacePanelHeader from "./WorkspacePanelHeader";
import WorkspaceTree from "./WorkspaceTree";

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

  return (
    <aside
      className={`workspace-panel ${isCompactWorkspaceLayout ? "compact" : "desktop"} ${isWorkspacePanelOpen ? "open" : ""}`}
      style={workspacePanelStyle}
    >
      <WorkspacePanelHeader
        workspaceRootLabel={workspaceRootLabel}
        refreshWorkspaceBrowser={refreshWorkspaceBrowser}
        setWorkspaceError={setWorkspaceError}
      />
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
            workspaceTree={workspaceTree}
            workspaceDirectoryStatus={workspaceDirectoryStatus}
            workspaceStatusItems={workspaceStatusItems}
            expandedWorkspaceDirs={expandedWorkspaceDirs}
            workspacePreview={workspacePreview}
            toggleWorkspaceDirectory={toggleWorkspaceDirectory}
            openWorkspaceFile={openWorkspaceFile}
            copyWorkspacePathToClipboard={copyWorkspacePathToClipboard}
          />
          {Array.isArray(workspaceTree[""]) && workspaceTree[""].length ? null : (
            <EmptyState className="workspace-panel-state">
              No files available.
            </EmptyState>
          )}
        </div>
      ) : null}
    </aside>
  );
}
