import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  resolveSettingsButtonAction,
  resolveSettingsPopoverPosition,
} from "../../state/settingsPopover.js";
import AppSidebarFrame from "../AppSidebarFrame";

const NOOP = () => {};

const BASE_PROPS = {
  children: null,
  isMobileLayout: false,
  isSidebarOpen: true,
  isDesktopSidebarCollapsed: false,
  sidebarStyle: {},
  isResizingSidebar: false,
  onToggleSidebarOpen: NOOP,
  onToggleSidebarCollapsed: NOOP,
  onStartSidebarResize: NOOP,
  settingsContent: React.createElement("div", null, "Settings Panel"),
};

test("settings button starts with the popover closed", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppSidebarFrame, BASE_PROPS),
  );

  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /sidebar-settings-btn/);
  assert.doesNotMatch(html, /sidebar-settings-popover/);
});

test("defaultSettingsOpen renders an accessible popover", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppSidebarFrame, {
      ...BASE_PROPS,
      defaultSettingsOpen: true,
    }),
  );

  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-label="Agent Settings"/);
  assert.match(html, /sidebar-settings-popover/);
});

test("settings button controls the rendered popover", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppSidebarFrame, {
      ...BASE_PROPS,
      defaultSettingsOpen: true,
    }),
  );

  const controlsMatch = html.match(/aria-controls="([^"]+)"/);
  assert.ok(controlsMatch, "aria-controls must be rendered");
  assert.match(html, new RegExp(`id="${controlsMatch[1]}"`));
});

test("settings content renders inside the popover", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppSidebarFrame, {
      ...BASE_PROPS,
      defaultSettingsOpen: true,
      settingsContent: React.createElement(
        "div",
        { className: "test-content" },
        "Custom Content",
      ),
    }),
  );

  assert.match(html, /test-content/);
  assert.match(html, /Custom Content/);
});

test("collapsed sidebar renders an independently open settings popover", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppSidebarFrame, {
      ...BASE_PROPS,
      isDesktopSidebarCollapsed: true,
      defaultSettingsOpen: true,
    }),
  );

  assert.match(html, /sidebar-settings-popover/);
  assert.match(html, /role="dialog"/);
});

test("closed mobile sidebar renders an independently open settings popover", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppSidebarFrame, {
      ...BASE_PROPS,
      isMobileLayout: true,
      isSidebarOpen: false,
      defaultSettingsOpen: true,
    }),
  );

  assert.match(html, /sidebar-settings-popover/);
});

test("collapsed sidebar hides the Settings label", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppSidebarFrame, {
      ...BASE_PROPS,
      isDesktopSidebarCollapsed: true,
    }),
  );

  assert.doesNotMatch(html, /sidebar-settings-label/);
});

test("expanded sidebar renders the Settings label", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppSidebarFrame, BASE_PROPS),
  );

  assert.match(html, /sidebar-settings-label/);
  assert.match(html, /Settings/);
});

test("collapsed sidebar renders the expand control", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppSidebarFrame, {
      ...BASE_PROPS,
      isDesktopSidebarCollapsed: true,
    }),
  );

  assert.match(html, /sidebar-collapsed-header/);
  assert.match(html, /sidebar-toggle-btn/);
  assert.match(html, /Expand sidebar/);
});

test("expanded sidebar omits the collapsed header", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppSidebarFrame, BASE_PROPS),
  );

  assert.doesNotMatch(html, /sidebar-collapsed-header/);
});

test("sidebar footer omits a duplicate collapse button", () => {
  const html = renderToStaticMarkup(
    React.createElement(AppSidebarFrame, BASE_PROPS),
  );

  assert.doesNotMatch(html, /sidebar-collapse-btn/);
});

test("desktop Settings toggles only the settings popover", () => {
  assert.deepEqual(
    resolveSettingsButtonAction({
      isMobileLayout: false,
      settingsOpen: false,
    }),
    { closeMobileSidebar: false, settingsOpen: true },
  );
  assert.deepEqual(
    resolveSettingsButtonAction({
      isMobileLayout: false,
      settingsOpen: true,
    }),
    { closeMobileSidebar: false, settingsOpen: false },
  );
});

test("mobile Settings closes the sidebar only when opening the popover", () => {
  assert.deepEqual(
    resolveSettingsButtonAction({
      isMobileLayout: true,
      settingsOpen: false,
    }),
    { closeMobileSidebar: true, settingsOpen: true },
  );
  assert.deepEqual(
    resolveSettingsButtonAction({
      isMobileLayout: true,
      settingsOpen: true,
    }),
    { closeMobileSidebar: false, settingsOpen: false },
  );
});

test("settings popover is 300px wide and anchored above its button", () => {
  assert.deepEqual(
    resolveSettingsPopoverPosition({
      buttonRect: { left: 12, top: 700 },
      viewportWidth: 1200,
      viewportHeight: 800,
    }),
    { left: 12, bottom: 108, width: 300, maxHeight: 684 },
  );
});

test("settings popover stays within the viewport", () => {
  assert.deepEqual(
    resolveSettingsPopoverPosition({
      buttonRect: { left: 900, top: 700 },
      viewportWidth: 1000,
      viewportHeight: 800,
    }),
    { left: 692, bottom: 108, width: 300, maxHeight: 684 },
  );
  assert.deepEqual(
    resolveSettingsPopoverPosition({
      buttonRect: { left: 12, top: 500 },
      viewportWidth: 320,
      viewportHeight: 600,
    }),
    { left: 12, bottom: 108, width: 300, maxHeight: 484 },
  );
});
