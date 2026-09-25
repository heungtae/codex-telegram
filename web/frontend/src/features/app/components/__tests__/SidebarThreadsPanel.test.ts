import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import SidebarThreadsPanel from "../SidebarThreadsPanel";

const NOOP = () => {};

const BASE_PROPS = {
  activeProjectTabId: "project:one",
  threadItems: [],
  threadTabsByProjectTabId: {},
  activeThread: "",
  onSelectThread: NOOP,
  onCloseThread: NOOP,
  onAddThread: NOOP,
  disableAddThread: false,
};

test("Threads 제목과 기본 펼침 렌더", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarThreadsPanel, {
      ...BASE_PROPS,
      threadItems: [{ id: "t-1", title: "Thread One" }],
    })
  );

  assert.match(html, /Threads/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /Thread One/);
});

test("접힌 상태에서 목록 숨김", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarThreadsPanel, {
      ...BASE_PROPS,
      threadItems: [{ id: "t-1", title: "Thread One" }],
      defaultOpen: false,
    })
  );

  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /Thread One/);
});

test("threadItems 순서 유지", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarThreadsPanel, {
      ...BASE_PROPS,
      threadItems: [
        { id: "t-1", title: "First Thread" },
        { id: "t-2", title: "Second Thread" },
        { id: "t-3", title: "Third Thread" },
      ],
    })
  );

  const first = html.indexOf("First Thread");
  const second = html.indexOf("Second Thread");
  const third = html.indexOf("Third Thread");
  assert.ok(first < second, "First Thread should appear before Second Thread");
  assert.ok(second < third, "Second Thread should appear before Third Thread");
});

test("열린 탭 상태 병합 — 열린 스레드에 닫기 버튼이 표시된다", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarThreadsPanel, {
      ...BASE_PROPS,
      threadItems: [{ id: "t-1", title: "Open Thread" }],
      threadTabsByProjectTabId: {
        "project:one": [{ id: "t-1", title: "Open Thread", status: "idle", hasUnreadCompletion: false }],
      },
    })
  );

  assert.match(html, /Close thread Open Thread/);
});

test("열리지 않은 스레드는 닫기 버튼이 없다", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarThreadsPanel, {
      ...BASE_PROPS,
      threadItems: [{ id: "t-1", title: "Closed Thread" }],
      threadTabsByProjectTabId: {},
    })
  );

  assert.doesNotMatch(html, /Close thread/);
});

test("빈 상태 메시지", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarThreadsPanel, {
      ...BASE_PROPS,
      threadItems: [],
    })
  );

  assert.match(html, /No threads in this project/);
});

test("새 채팅 버튼 존재", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarThreadsPanel, BASE_PROPS)
  );

  assert.match(html, /aria-label="Add thread"/);
});
