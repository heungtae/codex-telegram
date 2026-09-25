import test from "node:test";
import assert from "node:assert/strict";

import { clampWorkspaceTreeWidth, maxWorkspaceTreeWidth } from "./workspaceSplitSizing.js";

test("project tree width keeps space for the file preview", () => {
  assert.equal(clampWorkspaceTreeWidth(320, 800), 320);
  assert.equal(clampWorkspaceTreeWidth(1000, 800), 652);
  assert.equal(clampWorkspaceTreeWidth(20, 800), 140);
  assert.equal(clampWorkspaceTreeWidth(240, 340), 192);
  assert.equal(maxWorkspaceTreeWidth(340), 192);
});
