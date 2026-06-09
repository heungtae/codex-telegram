import { ChevronIcon, FileIcon, FolderIcon } from "../../common/components/Icons";
import { normalizeWorkspacePath, statusClassName } from "../../common/utils";
import { collectCompactWorkspaceEntry } from "../workspaceTreeModel";

export default function WorkspaceTree({
  workspaceTree,
  workspaceDirectoryStatus,
  workspaceStatusItems,
  expandedWorkspaceDirs,
  workspacePreview,
  toggleWorkspaceDirectory,
  openWorkspaceFile,
  copyWorkspacePathToClipboard,
  path = "",
  depth = 0,
}) {
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
          {compactEntry.isExpanded ? (
            <WorkspaceTree
              workspaceTree={workspaceTree}
              workspaceDirectoryStatus={workspaceDirectoryStatus}
              workspaceStatusItems={workspaceStatusItems}
              expandedWorkspaceDirs={expandedWorkspaceDirs}
              workspacePreview={workspacePreview}
              toggleWorkspaceDirectory={toggleWorkspaceDirectory}
              openWorkspaceFile={openWorkspaceFile}
              copyWorkspacePathToClipboard={copyWorkspacePathToClipboard}
              path={compactEntry.leafPath}
              depth={depth + compactEntry.segments.length}
            />
          ) : null}
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
}
