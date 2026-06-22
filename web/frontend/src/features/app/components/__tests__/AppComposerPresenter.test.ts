import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AppComposerPresenter from "../AppComposerPresenter";

function Icon() {
  return React.createElement("span", null, "icon");
}

function renderComposer(overrides = {}) {
  return renderToStaticMarkup(
    React.createElement(AppComposerPresenter, {
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
      ...overrides,
    })
  );
}

test("AppComposerPresenter renders composer controls through UI Kit", () => {
  const html = renderComposer();

  assert.match(html, /class="ui-textarea composer-input"/);
  assert.match(html, /class="ui-icon-button composer-action composer-send"/);
  assert.match(html, /class="ui-icon-button composer-action composer-new-chat"/);
});

test("AppComposerPresenter preserves running, compact, and busy control states", () => {
  const html = renderComposer({
    status: "running",
    isCompactWorkspaceLayout: true,
    isWorkspacePanelOpen: true,
    interactionBusy: true,
  });

  assert.match(html, /class="ui-icon-button composer-action composer-stop"/);
  assert.match(html, /class="ui-icon-button is-active composer-action composer-workspace-toggle active"/);
  assert.match(html, /aria-label="Workspace files"/);
  assert.match(html, /class="ui-icon-button composer-action composer-new-chat"[^>]*disabled=""/);
});
