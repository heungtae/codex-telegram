import React from "react";

export default function AppCenterPanePresenter({
  topTabs,
  centerPane,
  isCompactWorkspaceLayout,
  isWorkspacePanelOpen,
  workspacePanel,
}) {
  return (
    <>
      {topTabs}
      <div className="workspace-layout">
        <div className="center-pane">
          {centerPane}
          {isCompactWorkspaceLayout && isWorkspacePanelOpen ? workspacePanel : null}
        </div>
      </div>
    </>
  );
}
