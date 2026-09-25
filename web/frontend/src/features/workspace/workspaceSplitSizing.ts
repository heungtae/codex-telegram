export const WORKSPACE_SPLIT_HANDLE_WIDTH = 8;
export const WORKSPACE_SPLIT_MIN_PANE_WIDTH = 140;

export function maxWorkspaceTreeWidth(containerWidth: number): number {
  return Math.max(
    WORKSPACE_SPLIT_MIN_PANE_WIDTH,
    containerWidth - WORKSPACE_SPLIT_HANDLE_WIDTH - WORKSPACE_SPLIT_MIN_PANE_WIDTH,
  );
}

export function clampWorkspaceTreeWidth(width: number, containerWidth: number): number {
  return Math.max(WORKSPACE_SPLIT_MIN_PANE_WIDTH, Math.min(maxWorkspaceTreeWidth(containerWidth), width));
}
