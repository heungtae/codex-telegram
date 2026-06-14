import test from "node:test";
import assert from "node:assert/strict";

import { buildProjectRows } from "../projectRows.js";

const EMPTY_INPUT = {
  projectItems: [],
  projectTabs: [],
  threadTabsByProjectTabId: {},
  projectTabStatusById: {},
  activeProjectTabId: "",
};

test("열리지 않은 TOML 프로젝트 기본 행 생성", () => {
  const rows = buildProjectRows({
    ...EMPTY_INPUT,
    projectItems: [{ key: "alpha", name: "Alpha", path: "/alpha", default: true }],
  });

  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.type, "project");
  if (row.type === "project") {
    assert.equal(row.key, "alpha");
    assert.equal(row.name, "Alpha");
    assert.equal(row.path, "/alpha");
    assert.equal(row.isDefault, true);
  }
});

test("열린 프로젝트가 세션 행으로 대체된다", () => {
  const rows = buildProjectRows({
    ...EMPTY_INPUT,
    projectItems: [{ key: "alpha", name: "Alpha", path: "/alpha" }],
    projectTabs: [{ id: "project:alpha", key: "alpha", name: "Alpha", path: "/alpha" }],
  });

  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.type, "session");
  if (row.type === "session") {
    assert.equal(row.projectTabId, "project:alpha");
    assert.equal(row.key, "alpha");
  }
});

test("동일 프로젝트 복수 세션 독립 행 생성", () => {
  const rows = buildProjectRows({
    ...EMPTY_INPUT,
    projectItems: [{ key: "alpha", name: "Alpha", path: "/alpha" }],
    projectTabs: [
      { id: "project:alpha:1", key: "alpha", name: "Alpha", path: "/alpha" },
      { id: "project:alpha:2", key: "alpha", name: "Alpha", path: "/alpha" },
    ],
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].type, "session");
  assert.equal(rows[1].type, "session");
  if (rows[0].type === "session" && rows[1].type === "session") {
    assert.equal(rows[0].projectTabId, "project:alpha:1");
    assert.equal(rows[1].projectTabId, "project:alpha:2");
  }
});

test("TOML 프로젝트 순서 보존", () => {
  const rows = buildProjectRows({
    ...EMPTY_INPUT,
    projectItems: [
      { key: "charlie", name: "Charlie", path: "/charlie" },
      { key: "alpha", name: "Alpha", path: "/alpha" },
      { key: "bravo", name: "Bravo", path: "/bravo" },
    ],
  });

  assert.equal(rows.length, 3);
  assert.equal(rows[0].key, "charlie");
  assert.equal(rows[1].key, "alpha");
  assert.equal(rows[2].key, "bravo");
});

test("동일 프로젝트 세션 순서 보존", () => {
  const rows = buildProjectRows({
    ...EMPTY_INPUT,
    projectItems: [{ key: "alpha", name: "Alpha", path: "/alpha" }],
    projectTabs: [
      { id: "project:alpha:2", key: "alpha", name: "Alpha", path: "/alpha" },
      { id: "project:alpha:1", key: "alpha", name: "Alpha", path: "/alpha" },
    ],
  });

  assert.equal(rows.length, 2);
  if (rows[0].type === "session" && rows[1].type === "session") {
    assert.equal(rows[0].projectTabId, "project:alpha:2");
    assert.equal(rows[1].projectTabId, "project:alpha:1");
  }
});

test("프로젝트별 채팅 배열 격리", () => {
  const rows = buildProjectRows({
    ...EMPTY_INPUT,
    projectItems: [
      { key: "alpha", name: "Alpha", path: "/alpha" },
      { key: "bravo", name: "Bravo", path: "/bravo" },
    ],
    projectTabs: [
      { id: "project:alpha", key: "alpha", name: "Alpha", path: "/alpha" },
      { id: "project:bravo", key: "bravo", name: "Bravo", path: "/bravo" },
    ],
    threadTabsByProjectTabId: {
      "project:alpha": [{ id: "t-a", title: "Thread A", status: "idle", hasUnreadCompletion: false }],
      "project:bravo": [{ id: "t-b", title: "Thread B", status: "idle", hasUnreadCompletion: false }],
    },
  });

  assert.equal(rows.length, 2);
  if (rows[0].type === "session" && rows[1].type === "session") {
    assert.equal(rows[0].threadTabs.length, 1);
    assert.equal(rows[0].threadTabs[0].id, "t-a");
    assert.equal(rows[1].threadTabs.length, 1);
    assert.equal(rows[1].threadTabs[0].id, "t-b");
  }
});

test("상태와 활성 여부 매핑", () => {
  const rows = buildProjectRows({
    ...EMPTY_INPUT,
    projectItems: [
      { key: "alpha", name: "Alpha", path: "/alpha" },
      { key: "bravo", name: "Bravo", path: "/bravo" },
    ],
    projectTabs: [
      { id: "project:alpha", key: "alpha", name: "Alpha", path: "/alpha" },
      { id: "project:bravo", key: "bravo", name: "Bravo", path: "/bravo" },
    ],
    projectTabStatusById: {
      "project:alpha": "running",
      "project:bravo": "idle",
    },
    activeProjectTabId: "project:alpha",
  });

  assert.equal(rows.length, 2);
  if (rows[0].type === "session" && rows[1].type === "session") {
    assert.equal(rows[0].status, "running");
    assert.equal(rows[0].isActive, true);
    assert.equal(rows[1].status, "idle");
    assert.equal(rows[1].isActive, false);
  }
});

test("orphan 세션은 목록 끝에 표시된다", () => {
  const rows = buildProjectRows({
    ...EMPTY_INPUT,
    projectItems: [{ key: "alpha", name: "Alpha", path: "/alpha" }],
    projectTabs: [
      { id: "project:alpha", key: "alpha", name: "Alpha", path: "/alpha" },
      { id: "project:orphan", key: "orphan", name: "Orphan", path: "/orphan" },
    ],
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].key, "alpha");
  assert.equal(rows[0].type, "session");
  assert.equal(rows[1].key, "orphan");
  assert.equal(rows[1].type, "session");
});

test("빈 입력은 빈 배열을 반환한다", () => {
  const rows = buildProjectRows(EMPTY_INPUT);
  assert.deepEqual(rows, []);
});

test("빈 채팅 제목은 thread ID로 fallback한다", () => {
  const rows = buildProjectRows({
    ...EMPTY_INPUT,
    projectItems: [{ key: "alpha", name: "Alpha", path: "/alpha" }],
    projectTabs: [{ id: "project:alpha", key: "alpha", name: "Alpha", path: "/alpha" }],
    threadTabsByProjectTabId: {
      "project:alpha": [{ id: "t-1", title: "", status: "idle", hasUnreadCompletion: false }],
    },
  });
  assert.equal(rows.length, 1);
  if (rows[0].type === "session") {
    assert.equal(rows[0].threadTabs[0].title, "t-1");
  }
});

test("projectTabStatusById에 키가 없으면 status가 idle로 fallback한다", () => {
  const rows = buildProjectRows({
    ...EMPTY_INPUT,
    projectItems: [{ key: "alpha", name: "Alpha", path: "/alpha" }],
    projectTabs: [{ id: "project:alpha", key: "alpha", name: "Alpha", path: "/alpha" }],
    projectTabStatusById: {},
  });
  assert.equal(rows.length, 1);
  if (rows[0].type === "session") {
    assert.equal(rows[0].status, "idle");
  }
});
