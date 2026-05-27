import WorkspacePanel from "../../workspace/components/WorkspacePanel";
import { basename } from "../../common/utils";
import { getWorkspacePanelStyle } from "../state/layoutSelectors";

export default function AppWorkspacePanelSlot({
  isCompactWorkspaceLayout,
  isWorkspacePanelOpen,
  workspacePanelWidth,
  activeWorkspacePath,
  workspaceError,
  workspaceStatus,
  workspaceTree,
  expandedWorkspaceDirs,
  workspacePreview,
  toggleWorkspaceDirectory,
  openWorkspaceFile,
  refreshWorkspaceBrowser,
  setWorkspaceError,
  showToast,
}) {
  const workspaceRootLabel = basename(activeWorkspacePath || "") || "Workspace";
  const workspacePanelStyle = getWorkspacePanelStyle(isCompactWorkspaceLayout, workspacePanelWidth);
  const workspaceStatusItems =
    workspaceStatus && typeof workspaceStatus.items === "object" ? workspaceStatus.items : {};

  return (
    <WorkspacePanel
      isCompactWorkspaceLayout={isCompactWorkspaceLayout}
      isWorkspacePanelOpen={isWorkspacePanelOpen}
      workspacePanelStyle={workspacePanelStyle}
      workspaceRootLabel={workspaceRootLabel}
      workspaceError={workspaceError}
      activeWorkspacePath={activeWorkspacePath || ""}
      workspaceStatusItems={workspaceStatusItems}
      workspaceTree={workspaceTree}
      expandedWorkspaceDirs={expandedWorkspaceDirs}
      workspacePreview={workspacePreview}
      toggleWorkspaceDirectory={toggleWorkspaceDirectory}
      openWorkspaceFile={openWorkspaceFile}
      refreshWorkspaceBrowser={refreshWorkspaceBrowser}
      setWorkspaceError={setWorkspaceError}
      showToast={showToast}
    />
  );
}
