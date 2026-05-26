import WorkspacePreviewPanel from "../../workspace/components/WorkspacePreviewPanel";

export default function WorkspacePreviewOverlay({
  workspacePreview,
  isResizingWorkspacePreview,
  isMobileLayout,
  workspacePreviewWidth,
  workspacePreviewHeight,
  workspacePreviewResizeRef,
  setIsResizingWorkspacePreview,
  setWorkspacePreview,
  resetWorkspacePreviewSize,
}) {
  if (!workspacePreview) {
    return null;
  }

  return (
    <div
      className="modal-backdrop workspace-preview-backdrop"
      role="presentation"
      onMouseDown={() => setWorkspacePreview(null)}
    >
      <WorkspacePreviewPanel
        workspacePreview={workspacePreview}
        onClose={() => setWorkspacePreview(null)}
        onResetSize={resetWorkspacePreviewSize}
        className={`workspace-preview-modal ${isResizingWorkspacePreview ? "resizing" : ""}`}
        style={{
          width: isMobileLayout ? "calc(100vw - 20px)" : `${workspacePreviewWidth}px`,
          height: isMobileLayout ? "calc(100vh - 20px)" : `${workspacePreviewHeight}px`,
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onResizeWidthStart={
          !isMobileLayout
            ? (event) => {
                event.preventDefault();
                event.stopPropagation();
                workspacePreviewResizeRef.current = {
                  mode: "width",
                  startX: event.clientX,
                  startY: event.clientY,
                  startWidth: workspacePreviewWidth,
                  startHeight: workspacePreviewHeight,
                };
                setIsResizingWorkspacePreview(true);
              }
            : null
        }
        onResizeHeightStart={
          !isMobileLayout
            ? (event) => {
                event.preventDefault();
                event.stopPropagation();
                workspacePreviewResizeRef.current = {
                  mode: "height",
                  startX: event.clientX,
                  startY: event.clientY,
                  startWidth: workspacePreviewWidth,
                  startHeight: workspacePreviewHeight,
                };
                setIsResizingWorkspacePreview(true);
              }
            : null
        }
      />
    </div>
  );
}
