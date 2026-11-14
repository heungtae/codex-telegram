import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AddProjectModal, ProjectModeModal, ProjectPickerModal } from "../ProjectModals";

test("ProjectModeModal renders project tab choices when open", () => {
  const html = renderToStaticMarkup(
    React.createElement(ProjectModeModal, {
      isOpen: true,
      onClose: () => {},
      onChooseProjectClickMode: () => {},
    })
  );

  assert.match(html, /Choose Project Tab Behavior/);
  assert.match(html, /Open in New Tab/);
  assert.match(html, /Replace Current Tab/);
  assert.match(html, /ui-modal-card/);
  assert.match(html, /ui-button-primary/);
});

test("ProjectPickerModal renders filtered projects and selected state", () => {
  const html = renderToStaticMarkup(
    React.createElement(ProjectPickerModal, {
      isOpen: true,
      projectSearchQuery: "codex",
      onProjectSearchQueryChange: () => {},
      filteredProjects: [
        { key: "codex-telegram", name: "Codex Telegram", default: true },
        { key: "codex-api", name: "Codex API" },
      ],
      selectedProjectIndex: 1,
      onSelectedProjectIndexChange: () => {},
      onSelectProject: () => {},
      onClose: () => {},
    })
  );

  assert.match(html, /Codex Telegram/);
  assert.match(html, /codex-api/);
  assert.match(html, /ui-input project-picker-input/);
  assert.match(html, /ui-badge ui-badge-accent project-picker-badge/);
  assert.match(html, /project-picker-item selected/);
});

const noop = () => {};

test("Add Project has empty editable fields and an optional default checkbox", () => {
  const html = renderToStaticMarkup(React.createElement(AddProjectModal, {
    isOpen: true, onClose: noop, onAddProject: noop,
  }));
  assert.match(html, /Add Project/);
  assert.match(html, /Default project/);
  assert.doesNotMatch(html, /readonly/);
  assert.doesNotMatch(html, /checked=""/);
});

test("Modify Project prefills fields and keeps the project key stable", () => {
  const html = renderToStaticMarkup(React.createElement(AddProjectModal, {
    isOpen: true, onClose: noop, onAddProject: noop,
    project: { key: "alpha", name: "Alpha", path: "/alpha", default: false },
  }));
  assert.match(html, /Modify Project/);
  assert.match(html, /readonly=""[^>]*value="alpha"/);
  assert.match(html, /value="Alpha"/);
  assert.match(html, /value="\/alpha"/);
  assert.match(html, /Save Changes/);
});

test("Current default cannot be unset without choosing another project", () => {
  const html = renderToStaticMarkup(React.createElement(AddProjectModal, {
    isOpen: true, onClose: noop, onAddProject: noop,
    project: { key: "alpha", name: "Alpha", path: "/alpha", default: true },
  }));
  assert.match(html, /type="checkbox" disabled="" checked=""/);
});
