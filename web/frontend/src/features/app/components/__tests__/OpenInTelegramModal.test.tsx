import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import OpenInTelegramModal from "../OpenInTelegramModal";

function renderModal(overrides = {}) {
  return renderToStaticMarkup(
    React.createElement(OpenInTelegramModal, {
      isOpen: true,
      onClose: () => {},
      onConfirm: () => {},
      targetThreadId: "target-thread-123",
      targetThreadTitle: "Target thread",
      currentTelegramThreadId: "",
      currentTelegramThreadTitle: "",
      loading: false,
      errorMessage: "",
      ...overrides,
    })
  );
}

test("OpenInTelegramModal asks to connect the selected header thread", () => {
  const html = renderModal();

  assert.match(html, /Connect this thread to Telegram\?/);
  assert.match(html, /Target thread/);
  assert.match(html, />Yes</);
  assert.match(html, />No</);
  assert.doesNotMatch(html, /Available threads/);
  assert.doesNotMatch(html, /current/);
});

test("OpenInTelegramModal identifies the existing connection before replacement", () => {
  const html = renderModal({
    currentTelegramThreadId: "1234567890abcdef",
    currentTelegramThreadTitle: "Existing Telegram thread",
  });

  assert.match(html, /Change the Telegram connection to this thread\?/);
  assert.match(html, /12345678/);
  assert.match(html, /Existing Telegram thread/);
  assert.ok(
    html.indexOf("12345678") < html.indexOf("Existing Telegram thread"),
    "short thread ID should render before the title"
  );
});

test("OpenInTelegramModal uses state-specific loading labels", () => {
  assert.match(renderModal({ loading: true }), /Connecting\.\.\./);
  assert.match(
    renderModal({
      loading: true,
      currentTelegramThreadId: "thread-existing",
      currentTelegramThreadTitle: "Existing",
    }),
    /Changing\.\.\./
  );
});
