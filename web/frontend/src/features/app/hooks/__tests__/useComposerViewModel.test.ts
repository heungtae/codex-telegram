import test from "node:test";
import assert from "node:assert/strict";

import { createComposerViewModel } from "../useComposerViewModel";

test("createComposerViewModel packages composer props and handlers", async () => {
  const calls: string[] = [];
  const model = createComposerViewModel({
    activeToken: { type: "project" },
    activityDetail: "Running",
    paletteOpen: true,
    paletteRef: { current: null },
    visiblePaletteItems: ["alpha"],
    paletteWindowStart: 0,
    paletteSelectedIndex: 0,
    applyPaletteItem: (item) => calls.push(`apply:${item}`),
    collaborationMode: "build",
    composerLocked: false,
    modeSwitchBusy: false,
    toggleComposerMode: async () => {
      calls.push("toggle");
    },
    focusComposer: () => calls.push("focus"),
    inputRef: { current: null },
    input: "draft",
    onInputChange: () => {},
    onInputFocus: () => {},
    onInputBlur: () => {},
    onInputSelect: () => {},
    onInputKeyDown: () => {},
    status: "idle",
    interrupt: () => calls.push("interrupt"),
    sendMessage: () => calls.push("send"),
    isCompactWorkspaceLayout: true,
    isWorkspacePanelOpen: false,
    setIsWorkspacePanelOpen: (updater) => {
      calls.push(`workspace:${updater(false)}`);
    },
    startThread: async (options) => {
      calls.push(`start:${options.replaceCurrentTab}`);
    },
    interactionBusy: false,
    StopIcon: () => null,
    SendIcon: () => null,
    FolderIcon: () => null,
    NewChatIcon: () => null,
  });

  assert.equal(model.activeTokenType, "project");
  await model.onToggleComposerMode();
  model.onToggleWorkspacePanel();
  await model.onNewChat();

  assert.deepEqual(calls, ["toggle", "focus", "workspace:true", "start:true"]);
});
