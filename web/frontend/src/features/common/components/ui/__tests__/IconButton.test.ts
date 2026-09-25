import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import IconButton from "../IconButton.js";

test("IconButton renders accessible icon-only button state", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      IconButton,
      {
        active: true,
        "aria-label": "Close tab",
        className: "project-tab-close",
        disabled: true,
        title: "Close project tab",
      },
      React.createElement("span", null, "x")
    )
  );

  assert.match(html, /class="ui-icon-button is-active project-tab-close"/);
  assert.match(html, /aria-label="Close tab"/);
  assert.match(html, /title="Close project tab"/);
  assert.match(html, /disabled=""/);
});
