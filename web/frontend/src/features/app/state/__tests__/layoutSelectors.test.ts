import test from "node:test";
import assert from "node:assert/strict";

import {
  getSidebarStyle,
  getWorkspacePanelStyle,
  shouldShowWorkspacePanelDesktop,
} from "../layoutSelectors.js";

test("getWorkspacePanelStyle returns undefined in compact layout", () => {
  assert.equal(getWorkspacePanelStyle(true, 320), undefined);
});

test("getWorkspacePanelStyle returns width style in desktop layout", () => {
  assert.deepEqual(getWorkspacePanelStyle(false, 400), { width: 400 });
});

test("getSidebarStyle handles mobile and collapsed modes", () => {
  assert.equal(
    getSidebarStyle({
      isMobileLayout: true,
      isDesktopSidebarCollapsed: false,
      sidebarWidth: 340,
      collapsedWidth: 44,
    }),
    undefined
  );
  assert.deepEqual(
    getSidebarStyle({
      isMobileLayout: false,
      isDesktopSidebarCollapsed: true,
      sidebarWidth: 340,
      collapsedWidth: 44,
    }),
    { width: 44 }
  );
  assert.deepEqual(
    getSidebarStyle({
      isMobileLayout: false,
      isDesktopSidebarCollapsed: false,
      sidebarWidth: 360,
      collapsedWidth: 44,
    }),
    { width: 360 }
  );
});

test("shouldShowWorkspacePanelDesktop mirrors compact flag", () => {
  assert.equal(shouldShowWorkspacePanelDesktop(true), false);
  assert.equal(shouldShowWorkspacePanelDesktop(false), true);
});
