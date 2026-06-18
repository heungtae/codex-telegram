export function resolveSettingsButtonAction({
  isMobileLayout,
  settingsOpen,
}: {
  isMobileLayout: boolean;
  settingsOpen: boolean;
}) {
  const nextSettingsOpen = !settingsOpen;
  return {
    closeMobileSidebar: isMobileLayout && nextSettingsOpen,
    settingsOpen: nextSettingsOpen,
  };
}

export function resolveSettingsPopoverPosition({
  buttonRect,
  viewportWidth,
  viewportHeight,
  panelWidth = 300,
  gap = 8,
  edge = 8,
}: {
  buttonRect: { left: number; top: number };
  viewportWidth: number;
  viewportHeight: number;
  panelWidth?: number;
  gap?: number;
  edge?: number;
}) {
  const width = Math.max(0, Math.min(panelWidth, viewportWidth - edge * 2));
  const maxLeft = Math.max(edge, viewportWidth - edge - width);
  const left = Math.min(Math.max(buttonRect.left, edge), maxLeft);

  return {
    left,
    bottom: Math.max(edge, viewportHeight - buttonRect.top + gap),
    width,
    maxHeight: Math.max(0, buttonRect.top - gap - edge),
  };
}
