import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import Input from "../Input.js";

test("Input renders value, placeholder, and custom class", () => {
  const html = renderToStaticMarkup(
    React.createElement(Input, {
      className: "project-picker-input",
      value: "codex",
      placeholder: "Search projects...",
      onChange: () => {},
    })
  );

  assert.match(html, /class="ui-input project-picker-input"/);
  assert.match(html, /value="codex"/);
  assert.match(html, /placeholder="Search projects..."/);
});
