import test from "node:test";
import assert from "node:assert/strict";

import { clampDimension } from "../useUiDomain.js";

test("clampDimension respects min max bounds", () => {
  assert.equal(clampDimension(10, 20, 30), 20);
  assert.equal(clampDimension(40, 20, 30), 30);
  assert.equal(clampDimension(25, 20, 30), 25);
});
