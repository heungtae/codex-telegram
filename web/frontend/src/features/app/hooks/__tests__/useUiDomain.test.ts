import test from "node:test";
import assert from "node:assert/strict";

import { clampDimension, resolveInitialWorkspacePanelOpen } from "../useUiDomain.js";

test("clampDimension respects min max bounds", () => {
  assert.equal(clampDimension(10, 20, 30), 20);
  assert.equal(clampDimension(40, 20, 30), 30);
  assert.equal(clampDimension(25, 20, 30), 25);
});

test("resolveInitialWorkspacePanelOpen defaults desktop open and compact closed", () => {
  assert.equal(resolveInitialWorkspacePanelOpen(false, null), true);
  assert.equal(resolveInitialWorkspacePanelOpen(true, null), false);
});

test("resolveInitialWorkspacePanelOpen restores stored preference", () => {
  assert.equal(resolveInitialWorkspacePanelOpen(false, "closed"), false);
  assert.equal(resolveInitialWorkspacePanelOpen(true, "open"), true);
});
