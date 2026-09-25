export const WORKSPACE_PANEL_MIN = 340;
export const WORKSPACE_PANEL_MAX = 900;

export function resizedWorkspacePanelWidth(startWidth: number, startX: number, clientX: number): number {
  const nextWidth = startWidth + startX - clientX;
  return Math.max(WORKSPACE_PANEL_MIN, Math.min(WORKSPACE_PANEL_MAX, nextWidth));
}
