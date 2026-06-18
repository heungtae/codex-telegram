import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAppRuntimeContextValue,
  buildConversationViewModel,
} from "../useAppRuntimePresentation.js";

test("buildAppRuntimeContextValue preserves runtime context slices", () => {
  const domains = { ui: { isMobileLayout: false } };
  const runtime = { thread: { viewThread: () => {} } };
  const presentation = { shell: { theme: "dark" } };

  assert.deepEqual(
    buildAppRuntimeContextValue({ domains, runtime, presentation }),
    { domains, runtime, presentation }
  );
});

test("buildAppRuntimeContextValue preserves full threadTabsByProjectTabId map", () => {
  const threadTabsByProjectTabId = {
    "project:a": [{ id: "t-1", title: "Thread 1" }],
    "project:b": [{ id: "t-2", title: "Thread 2" }],
  };
  const value = buildAppRuntimeContextValue({
    domains: { threads: { threadTabsByProjectTabId } },
    runtime: {},
    presentation: {},
  });

  const threads = value.domains.threads as { threadTabsByProjectTabId: typeof threadTabsByProjectTabId };
  assert.equal(threads.threadTabsByProjectTabId, threadTabsByProjectTabId);
  assert.equal(Object.keys(threads.threadTabsByProjectTabId).length, 2);
});

test("buildConversationViewModel returns grouped pane sections", () => {
  const onSelectThread = () => {};
  const value = buildConversationViewModel({
    tabs: { onSelectThread, threadTabsByProjectTabId: {} },
    workspace: { workspacePanel: "workspace" },
    conversation: { renderItems: [] },
    composer: { input: "hello" },
    icons: { StopIcon: "stop" },
  });

  assert.equal(value.tabs.onSelectThread, onSelectThread);
  assert.equal(value.workspace.workspacePanel, "workspace");
  assert.equal(value.composer.input, "hello");
  assert.equal(value.icons.StopIcon, "stop");
});
