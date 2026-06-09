import { FileIcon } from "../../common/components/Icons";

export default function WorkspaceDeletedEntries({
  deletedWorkspaceEntries,
  openWorkspaceFile,
  copyWorkspacePathToClipboard,
}) {
  if (!deletedWorkspaceEntries.length) {
    return null;
  }

  return (
    <div className="workspace-tree-group">
      <div className="workspace-tree-group-label">Deleted</div>
      {deletedWorkspaceEntries.map(([path, value]) => {
        const status = value as { code?: string } | null;
        return (
          <button
            key={`deleted:${path}`}
            type="button"
            className="workspace-tree-item file deleted"
            title={path}
            onClick={() => {
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
            <span className="workspace-tree-badge">{status?.code || "D"}</span>
          </button>
        );
      })}
    </div>
  );
}
