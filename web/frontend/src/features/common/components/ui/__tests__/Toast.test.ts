import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import Toast from "../Toast.js";

test("Toast renders informational status by default", () => {
  const html = renderToStaticMarkup(React.createElement(Toast, { message: "Saved" }));

  assert.match(html, /class="ui-toast ui-toast-info toast-notification"/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-atomic="true"/);
  assert.match(html, /class="toast-message">Saved/);
});

test("Toast renders error messages as assertive alerts", () => {
  const html = renderToStaticMarkup(
    React.createElement(Toast, {
      message: "Failed to save",
      variant: "error",
    })
  );

  assert.match(html, /class="ui-toast ui-toast-error toast-notification"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /aria-live="assertive"/);
});

test("Toast renders success messages as polite status updates", () => {
  const html = renderToStaticMarkup(
    React.createElement(Toast, {
      message: "Copied",
      variant: "success",
    })
  );

  assert.match(html, /class="ui-toast ui-toast-success toast-notification"/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
});
