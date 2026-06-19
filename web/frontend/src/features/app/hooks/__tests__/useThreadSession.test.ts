import test from "node:test";
import assert from "node:assert/strict";

import { openThreadInTelegramForProject, upsertThreadSummary } from "../useThreadSession.js";

test("openThreadInTelegramForProject refreshes metadata and opens the thread in Web UI", async () => {
  const calls: string[] = [];
  const api = async (path: string, options?: Record<string, unknown>) => {
    calls.push(`api:${path}:${String(options?.method || "GET")}`);
    assert.equal(path, "/api/telegram/open-thread");
    assert.deepEqual(JSON.parse(String(options?.body)), {
      thread_id: "thread-2",
      project_key: "default",
    });
    return { ok: true };
  };
  const loadSessionSummary = async () => {
    calls.push("loadSessionSummary");
  };
  const loadThreads = async (options: Record<string, unknown>) => {
    calls.push(`loadThreads:${options.projectKey}:${options.projectTabId}:${options.revealThreadId}`);
  };
  const viewThread = async (threadId: string, projectTabId?: string) => {
    calls.push(`viewThread:${threadId}:${projectTabId}`);
  };

  await openThreadInTelegramForProject({
    threadId: " thread-2 ",
    activeProjectKey: "default",
    activeProjectTabId: "project:default",
    api,
    loadSessionSummary,
    loadThreads,
    viewThread,
  });

  assert.deepEqual(calls, [
    "api:/api/telegram/open-thread:POST",
    "loadSessionSummary",
    "loadThreads:default:project:default:thread-2",
    "viewThread:thread-2:project:default",
  ]);
});

test("upsertThreadSummary adds fallback row when summaries do not include telegram-created thread", () => {
  const next = upsertThreadSummary(
    [{ id: "thread-existing", title: "Existing" }],
    " thread-tg-1 "
  );

  assert.deepEqual(next, [
    { id: "thread-tg-1", title: "thread-tg-1" },
    { id: "thread-existing", title: "Existing" },
  ]);
});

test("upsertThreadSummary keeps existing summary and avoids duplicates", () => {
  const existing = [{ id: "thread-tg-1", title: "Telegram title", created_at: "now" }];
  const next = upsertThreadSummary(existing, "thread-tg-1");

  assert.equal(next, existing);
});
