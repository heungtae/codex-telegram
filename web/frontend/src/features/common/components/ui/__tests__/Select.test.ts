import test from "node:test";
import assert from "node:assert/strict";
import React, { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import Select from "../Select.js";

test("Select renders value, disabled state, options, and custom attributes", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      Select,
      {
        className: "agent-field-select",
        value: "20",
        disabled: true,
        "aria-label": "Timeout",
        onChange: () => {},
      },
      React.createElement("option", { value: "10" }, "10"),
      React.createElement("option", { value: "20" }, "20")
    )
  );

  assert.match(html, /class="ui-select agent-field-select"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /aria-label="Timeout"/);
  assert.match(html, /value="20" selected/);
});

test("Select accepts a forwarded ref", () => {
  const ref = createRef<HTMLSelectElement>();

  renderToStaticMarkup(
    React.createElement(
      Select,
      { ref, defaultValue: "build" },
      React.createElement("option", { value: "build" }, "Build")
    )
  );

  assert.equal(ref.current, null);
});
