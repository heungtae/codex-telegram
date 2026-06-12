import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AppConversationPane from "../AppConversationPane";

function Icon() {
  return React.createElement("span", null, "icon");
}

test("AppConversationPane renders tabs, chat feed, and composer controls", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppConversationPane, {
      tabs: {
        projectTabs: [{ id: "tab-1", name: "Project A" }],
        activeProjectTabId: "tab-1",
        projectTabStatusById: {},
        onSelectProjectTab: () => {},
        onCloseProjectTab: () => {},
        threadTabs: [{ id: "thread-1", title: "Thread One" }],
        activeThread: "thread-1",
        onSelectThread: () => {},
        onCloseThread: () => {},
        onAddThread: () => {},
        disableAddThread: false,
      },
      workspace: {
        workspacePreview: null,
        isResizingWorkspacePreview: false,
        isMobileLayout: false,
        workspacePreviewWidth: 400,
        workspacePreviewHeight: 300,
        workspacePreviewResizeRef: React.createRef(),
        setIsResizingWorkspacePreview: () => {},
        setWorkspacePreview: () => {},
        resetWorkspacePreviewSize: () => {},
        workspacePanel: React.createElement("aside", null, "Workspace"),
        isResizingWorkspacePanel: false,
        onStartWorkspacePanelResize: () => {},
      },
      conversation: {
        chatRef: React.createRef(),
        approvalItems: [],
        approvalBusyId: null,
        onSubmitApproval: () => {},
        onCloseApprovals: () => {},
        renderItems: [{ message: { role: "assistant", text: "Hello from assistant" } }],
      },
      composer: {
        activityDetail: "",
        paletteOpen: false,
        paletteRef: React.createRef(),
        visiblePaletteItems: [],
        paletteWindowStart: 0,
        paletteSelectedIndex: 0,
        activeTokenType: "",
        onApplyPaletteItem: () => {},
        collaborationMode: "build",
        composerLocked: false,
        modeSwitchBusy: false,
        onToggleComposerMode: () => {},
        inputRef: React.createRef(),
        input: "draft message",
        onInputChange: () => {},
        onInputFocus: () => {},
        onInputBlur: () => {},
        onInputSelect: () => {},
        onInputKeyDown: () => {},
        status: "idle",
        onInterrupt: () => {},
        onSendMessage: () => {},
        isCompactWorkspaceLayout: false,
        isWorkspacePanelOpen: false,
        onToggleWorkspacePanel: () => {},
        onNewChat: () => {},
        interactionBusy: false,
      },
      icons: {
        StopIcon: Icon,
        SendIcon: Icon,
        FolderIcon: Icon,
        NewChatIcon: Icon,
      },
    })
  );

  assert.match(html, /Project A/);
  assert.match(html, /Thread One/);
  assert.match(html, /Hello from assistant/);
  assert.match(html, /draft message/);
  assert.match(html, /class="ui-textarea composer-input"/);
  assert.match(html, /class="ui-icon-button composer-action composer-send"/);
});
