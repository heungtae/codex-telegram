import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import OpenInTelegramModal from "../OpenInTelegramModal";

test("OpenInTelegramModal renders thread choices and active Telegram thread", () => {
  const html = renderToStaticMarkup(
    React.createElement(OpenInTelegramModal, {
      isOpen: true,
      onClose: () => {},
      threadItems: [
        { id: "thread-1", title: "Thread One" },
        { id: "thread-2", title: "Thread Two" },
      ],
      selectedThreadId: "thread-2",
      onSelectThread: () => {},
      onConfirm: () => {},
      currentTelegramThreadId: "thread-1",
      currentTelegramThreadTitle: "Thread One",
      loading: false,
      errorMessage: "",
    })
  );

  assert.match(html, /Open in Telegram/);
  assert.match(html, /Active in Telegram:/);
  assert.match(html, /Thread One/);
  assert.match(html, /Thread Two/);
  assert.match(html, /current/);
  assert.match(html, /Open in Telegram/);
});
