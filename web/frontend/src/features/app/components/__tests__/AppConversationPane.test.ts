import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AppConversationPane from "../AppConversationPane";
import { shouldOpenInTelegramModal } from "../openInTelegramState";

function Icon() {
  return React.createElement("span", null, "icon");
}

test("Open in Telegram modal only opens for a different non-empty thread", () => {
  assert.equal(shouldOpenInTelegramModal("", "thread-1"), false);
  assert.equal(shouldOpenInTelegramModal("thread-1", "thread-1"), false);
  assert.equal(shouldOpenInTelegramModal(" thread-2 ", "thread-1"), true);
  assert.equal(shouldOpenInTelegramModal("thread-2", ""), true);
});

test("AppConversationPane renders chat header, chat feed, and composer controls", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppConversationPane, {
      tabs: {
        projectTabs: [{ id: "tab-1", name: "Project A" }],
        activeProjectTabId: "tab-1",
        projectTabStatusById: {},
        onSelectProjectTab: () => {},
        onCloseProjectTab: () => {},
        threadItems: [{ id: "thread-1", title: "Thread One" }],
        threadTabs: [{ id: "thread-1", title: "Thread One" }],
        activeThread: "thread-1",
        telegramActiveThreadId: "thread-1",
        onSelectThread: () => {},
        onCloseThread: () => {},
        onAddThread: () => {},
        onOpenThreadInTelegram: () => {},
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
      telegramModal: {
        isModalOpen: false,
        targetThread: { id: "", title: "" },
        busy: false,
        error: "",
        handleContextMenu: () => {},
        handleConfirm: () => {},
        handleClose: () => {},
      },
    })
  );

  assert.match(html, /Thread One/);
  assert.match(html, /class="chat-header"/);
  assert.doesNotMatch(html, /Project A/);
  assert.doesNotMatch(html, /class="top-tabs"/);
  assert.match(html, /Hello from assistant/);
  assert.match(html, /draft message/);
  assert.match(html, /class="ui-textarea composer-input"/);
  assert.match(html, /class="ui-icon-button composer-action composer-send"/);
});

test("AppConversationPane does not render the workspace panel shell when collapsed on desktop", () => {
  const baseProps = {
    tabs: {
      threadItems: [{ id: "thread-1", title: "Thread One" }],
      threadTabs: [{ id: "thread-1", title: "Thread One" }],
      activeThread: "thread-1",
      telegramActiveThreadId: "thread-1",
      onAddThread: () => {},
      onOpenThreadInTelegram: () => {},
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
      renderItems: [],
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
      input: "",
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
    telegramModal: {
      isModalOpen: false,
      targetThread: { id: "", title: "" },
      busy: false,
      error: "",
      handleContextMenu: () => {},
      handleConfirm: () => {},
      handleClose: () => {},
    },
  };

  const html = renderToStaticMarkup(React.createElement(AppConversationPane, baseProps));

  assert.doesNotMatch(html, /workspace-panel-rail/);
  assert.doesNotMatch(html, /workspace-panel-shell/);
});

test("AppConversationPane suppresses preview overlay on desktop layout", () => {
  const baseProps = {
    tabs: {
      threadItems: [{ id: "thread-1", title: "Thread One" }],
      threadTabs: [{ id: "thread-1", title: "Thread One" }],
      activeThread: "thread-1",
      telegramActiveThreadId: "thread-1",
      onAddThread: () => {},
      onOpenThreadInTelegram: () => {},
      disableAddThread: false,
    },
    workspace: {
      workspacePreview: {
        path: "README.md",
        mode: "file",
        status: "",
        loading: false,
        content: "hello",
        diff: "",
        previewAvailable: true,
        error: "",
        truncated: false,
        isBinary: false,
      },
      isResizingWorkspacePreview: false,
      isMobileLayout: false,
      workspacePreviewWidth: 400,
      workspacePreviewHeight: 300,
      workspacePreviewResizeRef: React.createRef(),
      setIsResizingWorkspacePreview: () => {},
      setWorkspacePreview: () => {},
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
      renderItems: [],
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
      input: "",
      onInputChange: () => {},
      onInputFocus: () => {},
      onInputBlur: () => {},
      onInputSelect: () => {},
      onInputKeyDown: () => {},
      status: "idle",
      onInterrupt: () => {},
      onSendMessage: () => {},
      isCompactWorkspaceLayout: false,
      isWorkspacePanelOpen: true,
      onToggleWorkspacePanel: () => {},
      onNewChat: () => {},
      interactionBusy: false,
    },
    telegramModal: {
      isModalOpen: false,
      targetThread: { id: "", title: "" },
      busy: false,
      error: "",
      handleContextMenu: () => {},
      handleConfirm: () => {},
      handleClose: () => {},
    },
  };

  const html = renderToStaticMarkup(React.createElement(AppConversationPane, baseProps));

  assert.doesNotMatch(html, /workspace-preview-backdrop/);
});

test("AppConversationPane keeps preview overlay on mobile layout", () => {
  const baseProps = {
    tabs: {
      threadItems: [{ id: "thread-1", title: "Thread One" }],
      threadTabs: [{ id: "thread-1", title: "Thread One" }],
      activeThread: "thread-1",
      telegramActiveThreadId: "thread-1",
      onAddThread: () => {},
      onOpenThreadInTelegram: () => {},
      disableAddThread: false,
    },
    workspace: {
      workspacePreview: {
        path: "README.md",
        mode: "file",
        status: "",
        loading: false,
        content: "hello",
        diff: "",
        previewAvailable: true,
        error: "",
        truncated: false,
        isBinary: false,
      },
      isResizingWorkspacePreview: false,
      isMobileLayout: true,
      workspacePreviewWidth: 400,
      workspacePreviewHeight: 300,
      workspacePreviewResizeRef: React.createRef(),
      setIsResizingWorkspacePreview: () => {},
      setWorkspacePreview: () => {},
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
      renderItems: [],
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
      input: "",
      onInputChange: () => {},
      onInputFocus: () => {},
      onInputBlur: () => {},
      onInputSelect: () => {},
      onInputKeyDown: () => {},
      status: "idle",
      onInterrupt: () => {},
      onSendMessage: () => {},
      isCompactWorkspaceLayout: true,
      isWorkspacePanelOpen: true,
      onToggleWorkspacePanel: () => {},
      onNewChat: () => {},
      interactionBusy: false,
    },
    telegramModal: {
      isModalOpen: false,
      targetThread: { id: "", title: "" },
      busy: false,
      error: "",
      handleContextMenu: () => {},
      handleConfirm: () => {},
      handleClose: () => {},
    },
  };

  const html = renderToStaticMarkup(React.createElement(AppConversationPane, baseProps));

  assert.match(html, /workspace-preview-backdrop/);
});
