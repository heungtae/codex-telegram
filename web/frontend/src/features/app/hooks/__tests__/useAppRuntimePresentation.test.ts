import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAppRuntimeContextValue,
  buildConversationViewModel,
} from "../useAppRuntimePresentation.js";

test("open in Telegram action preserves rejected promises for the modal", async () => {
  const presentationModule = await import("../useAppRuntimePresentation.js");
  const createAction = presentationModule.createOpenInTelegramAction;

  assert.equal(typeof createAction, "function");
  if (typeof createAction !== "function") {
    return;
  }

  const failure = new Error("open in Telegram failed");
  const action = createAction(async () => {
    throw failure;
  });

  await assert.rejects(action("thread-1"), failure);
});

test("telegram active thread id is read from the session summary", async () => {
  const presentationModule = await import("../useAppRuntimePresentation.js");
  const resolveThreadId = presentationModule.resolveTelegramActiveThreadId;

  assert.equal(typeof resolveThreadId, "function");
  if (typeof resolveThreadId !== "function") {
    return;
  }

  assert.equal(resolveThreadId({ telegram_active_thread_id: " thread-1 " }), "thread-1");
  assert.equal(resolveThreadId({ telegram_active_thread_id: null }), "");
  assert.equal(resolveThreadId(null), "");
});

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
  });

  assert.equal(value.tabs.onSelectThread, onSelectThread);
  assert.equal(value.workspace.workspacePanel, "workspace");
  assert.equal(value.composer.input, "hello");
});
