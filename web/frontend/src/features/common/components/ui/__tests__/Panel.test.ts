import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import Panel from "../Panel.js";

test("Panel renders shared, feature, and custom attributes", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      Panel,
      {
        className: "threads-panel",
        id: "threads-panel",
      },
      "Thread content"
    )
  );

  assert.match(html, /class="ui-panel panel threads-panel"/);
  assert.match(html, /id="threads-panel"/);
  assert.match(html, /Thread content/);
});
