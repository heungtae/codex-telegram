import { buildProjectRows } from "../state/projectRows.js";
import SidebarHeaderActions from "./SidebarHeaderActions";
import SidebarProjectsPanel from "./SidebarProjectsPanel";
import SidebarThreadsPanel from "./SidebarThreadsPanel";

export default function AppSidebarContentPanel({
  turnNotificationEnabled,
  setTurnNotificationEnabled,
  persistTurnNotificationEnabled,
  onToggleTheme,
  theme,
  onToggleSidebarOpen,
  onToggleSidebarCollapsed,
  isMobileLayout,
  interactionBusy,
  projectItems,
  selectProject,
  projectTabs,
  activeProjectTabId,
  projectTabStatusById,
  onSelectProjectTab,
  onCloseProjectTab,
  threadItems,
  threadTabsByProjectTabId,
  activeThread,
  onSelectThread,
  onCloseThread,
  onAddThread,
  disableAddThread,
}) {
  const projectRows = buildProjectRows({
    projectItems,
    projectTabs,
    threadTabsByProjectTabId,
    projectTabStatusById,
    activeProjectTabId: activeProjectTabId as string,
  });

  return (
    <>
      <SidebarHeaderActions
        turnNotificationEnabled={turnNotificationEnabled}
        setTurnNotificationEnabled={setTurnNotificationEnabled}
        persistTurnNotificationEnabled={persistTurnNotificationEnabled}
        onToggleTheme={onToggleTheme}
        theme={theme}
        onToggleSidebarOpen={onToggleSidebarOpen}
        onToggleSidebarCollapsed={onToggleSidebarCollapsed}
        isMobileLayout={isMobileLayout}
      />
      <SidebarProjectsPanel
        projectRows={projectRows}
        activeThread={activeThread}
        interactionBusy={interactionBusy}
        disableAddThread={disableAddThread}
        onSelectProject={(key) => (selectProject as (k: string) => Promise<unknown>)(key).catch(() => {})}
        onSelectProjectTab={onSelectProjectTab}
        onCloseProjectTab={onCloseProjectTab}
        onSelectThread={onSelectThread}
        onCloseThread={onCloseThread}
        onAddThread={onAddThread}
      />
      <SidebarThreadsPanel
        activeProjectTabId={activeProjectTabId}
        threadItems={threadItems}
        threadTabsByProjectTabId={threadTabsByProjectTabId}
        activeThread={activeThread}
        onSelectThread={onSelectThread}
        onCloseThread={onCloseThread}
        onAddThread={onAddThread}
        disableAddThread={disableAddThread}
      />
    </>
  );
}
