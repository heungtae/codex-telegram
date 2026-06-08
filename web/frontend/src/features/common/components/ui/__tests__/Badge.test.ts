import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import Badge from "../Badge.js";

test("Badge renders variant and custom class", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      Badge,
      {
        variant: "accent",
        className: "project-picker-badge",
      },
      "default"
    )
  );

  assert.match(html, /class="ui-badge ui-badge-accent project-picker-badge"/);
  assert.match(html, />default<\/span>/);
});
