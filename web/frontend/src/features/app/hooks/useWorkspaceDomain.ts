import { useState } from "react";

import useWorkspaceBrowser from "../../workspace/hooks/useWorkspaceBrowser";

export default function useWorkspaceDomain({
  activeThread,
  activeProjectTabId,
  activeProjectKey,
  threadProjectTabIdByThreadId,
  activeProjectTabPath,
  sessionWorkspace,
  readWorkspacePreviewWidth,
  readWorkspacePreviewHeight,
  workspacePreviewDefaults,
}) {
  const [workspacePanelWidth, setWorkspacePanelWidth] = useState(320);
  const [isResizingWorkspacePanel, setIsResizingWorkspacePanel] = useState(false);
  const [workspacePreviewWidth, setWorkspacePreviewWidth] = useState(() =>
    readWorkspacePreviewWidth(
      workspacePreviewDefaults.defaultWidth,
      workspacePreviewDefaults.minWidth,
      workspacePreviewDefaults.maxWidth
    )
  );
  const [workspacePreviewHeight, setWorkspacePreviewHeight] = useState(() =>
    readWorkspacePreviewHeight(
      workspacePreviewDefaults.defaultHeight,
      workspacePreviewDefaults.minHeight,
      workspacePreviewDefaults.maxHeight
    )
  );
  const [isResizingWorkspacePreview, setIsResizingWorkspacePreview] = useState(false);

  const workspaceBrowser = useWorkspaceBrowser({
    activeThread,
    activeProjectTabId,
    activeProjectKey,
    threadProjectTabIdByThreadId,
    activeProjectTabPath,
    sessionWorkspace,
  });

  const actions = {
    setWorkspacePanelWidth,
    setIsResizingWorkspacePanel,
    setWorkspacePreviewWidth,
    setWorkspacePreviewHeight,
    setIsResizingWorkspacePreview,
  };

  return {
    workspacePanelWidth,
    isResizingWorkspacePanel,
    workspacePreviewWidth,
    workspacePreviewHeight,
    isResizingWorkspacePreview,
    ...workspaceBrowser,
    ...actions,
    actions,
  };
}
