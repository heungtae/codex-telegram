import { FileChangeDiff, FileCodePreview } from "./FilePreviewParts";

export default function WorkspacePreviewPanel({ workspacePreview, onClose }) {
  if (!workspacePreview) {
    return null;
  }
  return (
    <div className={`workspace-preview-panel ${workspacePreview.mode === "diff" ? "diff-mode" : "file-mode"}`}>
      <div className="workspace-preview-head">
        <div className="workspace-preview-copy">
          <div className="workspace-preview-title">
            {workspacePreview.mode === "diff" ? "Diff Preview" : "File Preview"}
          </div>
          <div className="workspace-preview-path">
            {workspacePreview.status ? `[${workspacePreview.status}] ` : ""}
            {workspacePreview.path}
          </div>
        </div>
        <button
          className="workspace-preview-close"
          type="button"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      {workspacePreview.loading ? (
        <div className="workspace-preview-empty">Loading preview...</div>
      ) : workspacePreview.error ? (
        <div className="workspace-preview-empty">{workspacePreview.error}</div>
      ) : workspacePreview.mode === "diff" && workspacePreview.diff ? (
        <div className="workspace-preview-body">
          <FileChangeDiff diff={workspacePreview.diff} />
        </div>
      ) : !workspacePreview.previewAvailable ? (
        <div className="workspace-preview-empty">
          {workspacePreview.isBinary ? "Binary file preview is unavailable." : "Preview is unavailable."}
        </div>
      ) : (
        <>
          {workspacePreview.truncated ? (
            <div className="workspace-preview-note">Showing the first part of the file.</div>
          ) : null}
          <div className="workspace-preview-body">
            <FileCodePreview content={workspacePreview.content} />
          </div>
        </>
      )}
    </div>
  );
}
