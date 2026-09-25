import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAppRuntimeContextValue,
  buildConversationViewModel,
} from "../useAppRuntimePresentation.js";

test("buildAppRuntimeContextValue preserves domain, runtime, and presentation slices", () => {
  const domains = { ui: { isMobileLayout: false } };
  const runtime = { thread: { viewThread: () => {} } };
  const presentation = { shell: { theme: "dark" } };

  const value = buildAppRuntimeContextValue({ domains, runtime, presentation });

  assert.deepEqual(value, { domains, runtime, presentation });
});

test("buildConversationViewModel returns grouped conversation props without changing callbacks", () => {
  const onSelectThread = () => {};
  const composer = { input: "hello", sendMessage: () => {} };
  const workspacePanel = { type: "workspace" };

  const value = buildConversationViewModel({
    tabs: {
      projectTabs: [{ id: "project-1" }],
      activeProjectTabId: "project-1",
      projectTabStatusById: { "project-1": "idle" },
      onSelectProjectTab: () => {},
      onCloseProjectTab: () => {},
      threadTabs: [{ id: "thread-1" }],
      activeThread: "thread-1",
      onSelectThread,
      onCloseThread: () => {},
      onAddThread: () => {},
      disableAddThread: false,
    },
    workspace: {
      workspacePreview: null,
      workspacePanel,
    },
    conversation: {
      renderItems: [],
      approvalItems: [],
    },
    composer,
  });

  assert.equal(value.tabs.onSelectThread, onSelectThread);
  assert.equal(value.composer.input, "hello");
  assert.equal(value.workspace.workspacePanel, workspacePanel);
});
