import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import Textarea from "../Textarea.js";

test("Textarea renders value, placeholder, rows, and custom class", () => {
  const html = renderToStaticMarkup(
    React.createElement(Textarea, {
      className: "composer-input",
      value: "draft message",
      placeholder: "Message...",
      rows: 1,
      onChange: () => {},
    })
  );

  assert.match(html, /class="ui-textarea composer-input"/);
  assert.match(html, /rows="1"/);
  assert.match(html, /placeholder="Message..."/);
  assert.match(html, />draft message<\/textarea>/);
});
