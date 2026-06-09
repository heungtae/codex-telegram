import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import EmptyState from "../EmptyState.js";

test("EmptyState renders default tone and feature classes", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      EmptyState,
      {
        className: "project-picker-empty",
        id: "empty-projects",
      },
      "No projects found"
    )
  );

  assert.match(
    html,
    /class="ui-empty-state ui-empty-state-default project-picker-empty"/
  );
  assert.match(html, /id="empty-projects"/);
  assert.match(html, />No projects found</);
});

test("EmptyState renders notice tone", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      EmptyState,
      {
        tone: "notice",
        className: "panel-note",
      },
      "Project switch is unavailable."
    )
  );

  assert.match(
    html,
    /class="ui-empty-state ui-empty-state-notice panel-note"/
  );
});
