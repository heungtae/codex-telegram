import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import Button from "../Button.js";

test("Button renders variant, disabled state, and custom class", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      Button,
      {
        variant: "secondary",
        className: "extra-action",
        disabled: true,
      },
      "Save"
    )
  );

  assert.match(html, /class="ui-button ui-button-secondary extra-action"/);
  assert.match(html, /disabled=""/);
  assert.match(html, />Save<\/button>/);
});
