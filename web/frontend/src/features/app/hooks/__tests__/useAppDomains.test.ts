import test from "node:test";
import assert from "node:assert/strict";

import { buildAppDomains } from "../useAppDomains.js";

test("buildAppDomains keeps domain state grouped by ownership", () => {
  const threads = { activeThread: "thread-1" };
  const session = { collaborationMode: "build" };
  const ui = { isMobileLayout: false };
  const approvals = { approvalItems: [] };

  const domains = buildAppDomains({ threads, session, ui, approvals });

  assert.deepEqual(domains, { threads, session, ui, approvals });
});
