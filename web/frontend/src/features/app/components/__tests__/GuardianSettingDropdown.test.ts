import test from "node:test";
import assert from "node:assert/strict";

import {
  getGuardianSettingLabel,
  getNextDropdownIndex,
} from "../../state/guardianSettingOptions";

test("getGuardianSettingLabel preserves the configured value text", () => {
  assert.equal(getGuardianSettingLabel("timeout_seconds", 8), "8");
  assert.equal(getGuardianSettingLabel("failure_policy", "manual_fallback"), "manual_fallback");
  assert.equal(getGuardianSettingLabel("failure_policy", "session"), "session");
  assert.equal(getGuardianSettingLabel("explainability", "decision_only"), "decision_only");
  assert.equal(getGuardianSettingLabel("unknown", "raw_value"), "raw_value");
});

test("getNextDropdownIndex wraps keyboard navigation through all options", () => {
  assert.equal(getNextDropdownIndex("ArrowDown", 0, 3), 1);
  assert.equal(getNextDropdownIndex("ArrowDown", 2, 3), 0);
  assert.equal(getNextDropdownIndex("ArrowUp", 0, 3), 2);
  assert.equal(getNextDropdownIndex("Home", 2, 3), 0);
  assert.equal(getNextDropdownIndex("End", 0, 3), 2);
  assert.equal(getNextDropdownIndex("Escape", 1, 3), 1);
});
