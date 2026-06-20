import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  ComposeIcon,
  ExpandIcon,
  FileIcon,
  FolderIcon,
  MenuIcon,
  MoreIcon,
  NewChatIcon,
  NotificationIcon,
  PanelRightIcon,
  RefreshIcon,
  SaveIcon,
  SendIcon,
  SettingsIcon,
  SidebarToggleIcon,
  StopIcon,
  ThemeIcon,
} from "../Icons";

function renderIcon(component, props = {}) {
  return renderToStaticMarkup(React.createElement(component, props));
}

test("stateful icons select the expected Lucide glyph", () => {
  assert.match(renderIcon(ThemeIcon, { theme: "light" }), /lucide-sun/);
  assert.match(renderIcon(ThemeIcon, { theme: "dark" }), /lucide-moon/);
  assert.match(renderIcon(NotificationIcon, { enabled: true }), /lucide-bell/);
  assert.match(renderIcon(NotificationIcon, { enabled: false }), /lucide-bell-off/);
  assert.match(renderIcon(ChevronIcon, { expanded: true }), /lucide-chevron-down/);
  assert.match(renderIcon(ChevronIcon), /lucide-chevron-right/);
  assert.match(renderIcon(FolderIcon, { open: true }), /lucide-folder-open/);
  assert.match(renderIcon(FolderIcon), /lucide-folder/);
  assert.match(renderIcon(ExpandIcon, { expanded: true }), /lucide-minimize/);
  assert.match(renderIcon(ExpandIcon), /lucide-maximize/);
});

test("panel icons do not change between open and close states", () => {
  assert.match(renderIcon(SidebarToggleIcon, { collapsed: true }), /lucide-panel-left/);
  assert.match(renderIcon(SidebarToggleIcon, { collapsed: false }), /lucide-panel-left/);
  assert.match(renderIcon(PanelRightIcon), /lucide-panel-right/);
});

test("shared semantic icons use Lucide markup", () => {
  for (const [component, className] of [
    [SendIcon, "send-horizontal"],
    [StopIcon, "square"],
    [NewChatIcon, "plus"],
    [RefreshIcon, "rotate-cw"],
    [SaveIcon, "save"],
    [SettingsIcon, "settings"],
    [MenuIcon, "menu"],
    [FileIcon, "file-code"],
    [CloseIcon, "x"],
    [MoreIcon, "ellipsis"],
    [ComposeIcon, "square-pen"],
    [CheckIcon, "check"],
  ]) {
    assert.match(renderIcon(component), new RegExp(`lucide-${className}`));
  }
});
