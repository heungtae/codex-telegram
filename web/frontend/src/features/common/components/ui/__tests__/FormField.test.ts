import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import FormField from "../FormField.js";

test("FormField renders label, control, help, and custom attributes", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      FormField,
      {
        label: "Rules TOML",
        help: "Only configured rules are active.",
        className: "agent-field",
        helpClassName: "agent-field-help",
        id: "guardian-rules",
      },
      React.createElement("textarea", { defaultValue: "allow = true" })
    )
  );

  assert.match(html, /class="ui-form-field agent-field"/);
  assert.match(html, /id="guardian-rules"/);
  assert.match(html, /class="ui-form-field-label">Rules TOML/);
  assert.match(html, /allow = true/);
  assert.match(
    html,
    /class="ui-form-field-help agent-field-help">Only configured rules are active/
  );
});

test("FormField omits help markup when help is not provided", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      FormField,
      { label: "Timeout" },
      React.createElement("select", null)
    )
  );

  assert.doesNotMatch(html, /ui-form-field-help/);
});
