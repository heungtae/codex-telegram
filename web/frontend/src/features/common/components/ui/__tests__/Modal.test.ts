import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import Modal from "../Modal.js";

test("Modal renders nothing when closed", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      Modal,
      {
        isOpen: false,
        onClose: () => {},
        ariaLabel: "Closed modal",
      },
      "Hidden"
    )
  );

  assert.equal(html, "");
});

test("Modal renders accessible dialog shell when open", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      Modal,
      {
        isOpen: true,
        onClose: () => {},
        ariaLabel: "Project picker",
        className: "project-picker-modal",
      },
      React.createElement("div", null, "Project picker content")
    )
  );

  assert.match(html, /class="modal-backdrop ui-modal-backdrop"/);
  assert.match(html, /class="modal-card ui-modal-card project-picker-modal"/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-label="Project picker"/);
});
