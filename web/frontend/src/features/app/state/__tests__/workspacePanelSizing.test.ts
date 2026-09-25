import test from "node:test";
import assert from "node:assert/strict";

import { resizedWorkspacePanelWidth } from "../workspacePanelSizing.js";

test("workspace panel width follows pointer movement and stays within limits", () => {
  assert.equal(resizedWorkspacePanelWidth(520, 1000, 900), 620);
  assert.equal(resizedWorkspacePanelWidth(520, 1000, 1200), 340);
  assert.equal(resizedWorkspacePanelWidth(520, 1000, 500), 900);
});
