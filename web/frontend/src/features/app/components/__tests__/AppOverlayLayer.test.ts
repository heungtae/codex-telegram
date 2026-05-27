import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AppOverlayLayer from "../AppOverlayLayer";

test("AppOverlayLayer renders project modals and toast notification", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppOverlayLayer, {
      isProjectModeModalOpen: true,
      onCloseProjectModeModal: () => {},
      onChooseProjectClickMode: () => {},
      isProjectPickerOpen: true,
      projectSearchQuery: "",
      onProjectSearchQueryChange: () => {},
      filteredProjects: [{ key: "codex-telegram", name: "Codex Telegram", default: true }],
      selectedProjectIndex: 0,
      onSelectedProjectIndexChange: () => {},
      onSelectProject: () => {},
      onCloseProjectPicker: () => {},
      toastNotification: { message: "Saved" },
    })
  );

  assert.match(html, /Choose Project Tab Behavior/);
  assert.match(html, /Codex Telegram/);
  assert.match(html, /Saved/);
});
