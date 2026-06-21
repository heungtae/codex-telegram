import React from "react";
import WorkspacePanel from "../../workspace/components/WorkspacePanel";
import { basename } from "../../common/utils";
import { getWorkspacePanelStyle } from "../state/layoutSelectors";

export default function AppWorkspacePanelSlot({
  isCompactWorkspaceLayout,
  isWorkspacePanelOpen,
  onToggleWorkspacePanel,
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
  isWorkspaceExpanded,
  onToggleWorkspaceExpand,
}) {
  const workspaceRootLabel = basename(activeWorkspacePath || "") || "Workspace";
  const workspacePanelStyle = getWorkspacePanelStyle(isCompactWorkspaceLayout, workspacePanelWidth, isWorkspaceExpanded);
  const workspaceStatusItems =
    workspaceStatus && typeof workspaceStatus.items === "object" ? workspaceStatus.items : {};

  return (
    <WorkspacePanel
      isCompactWorkspaceLayout={isCompactWorkspaceLayout}
      isWorkspacePanelOpen={isWorkspacePanelOpen}
      onToggleWorkspacePanel={onToggleWorkspacePanel}
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
      isWorkspaceExpanded={isWorkspaceExpanded}
      onToggleWorkspaceExpand={onToggleWorkspaceExpand}
    />
  );
}
