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

test("buildConversationViewModel flattens pane sections", () => {
  const onSelectThread = () => {};
  const value = buildConversationViewModel({
    tabs: { onSelectThread },
    workspace: { workspacePanel: "workspace" },
    conversation: { renderItems: [] },
    composer: { input: "hello" },
    icons: { StopIcon: "stop" },
  });

  assert.equal(value.onSelectThread, onSelectThread);
  assert.equal(value.workspacePanel, "workspace");
  assert.equal(value.input, "hello");
  assert.equal(value.StopIcon, "stop");
});
