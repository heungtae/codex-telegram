import { FileChangeDiff, FileCodePreview } from "./FilePreviewParts";
import { CloseIcon, ResetSizeIcon } from "../../common/components/Icons";

export default function WorkspacePreviewPanel({
  workspacePreview,
  onClose,
  onResetSize,
  className = "",
  style,
  onMouseDown,
  onResizeWidthStart,
  onResizeHeightStart,
}) {
  if (!workspacePreview) {
    return null;
  }
  const isDiffMode = workspacePreview.mode === "diff";
  return (
    <div
      className={`workspace-preview-panel ${isDiffMode ? "diff-mode" : "file-mode"} ${className}`.trim()}
      style={style}
      role="dialog"
      aria-modal="true"
      aria-label={isDiffMode ? "Diff preview" : "File preview"}
      onMouseDown={onMouseDown}
    >
      <div className="workspace-preview-head">
        <div className="workspace-preview-copy">
          <div className="workspace-preview-title">
            {isDiffMode ? "Diff Preview" : "File Preview"}
          </div>
          <div className="workspace-preview-path">
            {workspacePreview.status ? `[${workspacePreview.status}] ` : ""}
            {workspacePreview.path}
          </div>
        </div>
        <div className="workspace-preview-actions">
          {onResetSize ? (
            <button
              className="workspace-preview-action workspace-preview-reset"
              type="button"
              onClick={onResetSize}
              title="Reset preview size to the default dimensions"
              aria-label="Reset preview size to the default dimensions"
            >
              <ResetSizeIcon />
            </button>
          ) : null}
          <button
            className="workspace-preview-action workspace-preview-close"
            type="button"
            onClick={onClose}
            title="Close preview (Esc)"
            aria-label="Close preview (Esc)"
          >
            <CloseIcon />
          </button>
        </div>
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
      {onResizeWidthStart ? (
        <div
          className="workspace-preview-resizer workspace-preview-resizer-width"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize file preview width"
          onMouseDown={onResizeWidthStart}
        />
      ) : null}
      {onResizeHeightStart ? (
        <div
          className="workspace-preview-resizer workspace-preview-resizer-height"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize file preview height"
          onMouseDown={onResizeHeightStart}
        />
      ) : null}
    </div>
  );
}
