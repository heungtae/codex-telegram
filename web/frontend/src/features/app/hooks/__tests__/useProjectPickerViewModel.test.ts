import test from "node:test";
import assert from "node:assert/strict";

import { filterProjectItems, createProjectPickerActions } from "../useProjectPickerViewModel";

test("filterProjectItems filters by project name or key", () => {
  const items = [
    { key: "codex-telegram", name: "Codex Telegram" },
    { key: "java-selector", name: "Java Selector" },
  ];

  assert.deepEqual(filterProjectItems(items, "telegram"), [items[0]]);
  assert.deepEqual(filterProjectItems(items, "java-selector"), [items[1]]);
  assert.deepEqual(filterProjectItems(items, ""), items);
});

test("createProjectPickerActions closes modals and selects a project", async () => {
  const calls: string[] = [];
  const actions = createProjectPickerActions({
    setPendingProjectTarget: (value) => calls.push(`target:${value}`),
    setIsProjectModeModalOpen: (value) => calls.push(`mode:${value}`),
    setShortcutModalPage: (value) => calls.push(`page:${value}`),
    setProjectSearchQuery: (value) => calls.push(`query:${value}`),
    selectProject: async (key) => {
      calls.push(`select:${key}`);
    },
  });

  actions.closeProjectModeModal();
  await actions.selectProjectFromPicker("codex-telegram");

  assert.deepEqual(calls, [
    "target:",
    "mode:false",
    "select:codex-telegram",
    "page:main",
    "query:",
  ]);
});
