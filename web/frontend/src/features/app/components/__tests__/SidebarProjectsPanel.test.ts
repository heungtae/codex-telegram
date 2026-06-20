import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import SidebarProjectsPanel from "../SidebarProjectsPanel";
import type { ProjectRow } from "../../state/projectRows.js";

const NOOP = () => {};

const BASE_PROPS = {
  projectRows: [] as ProjectRow[],
  activeThread: "",
  telegramActiveThreadId: "",
  interactionBusy: false,
  disableAddThread: false,
  onSelectProject: NOOP,
  onSelectProjectTab: NOOP,
  onCloseProjectTab: NOOP,
  onSelectThread: NOOP,
  onCloseThread: NOOP,
  onAddThread: NOOP,
};

test("Telegram-connected open thread renders a T badge before its title", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarProjectsPanel, {
      ...BASE_PROPS,
      telegramActiveThreadId: "t-1",
      projectRows: [
        {
          type: "session",
          projectTabId: "project:alpha",
          key: "alpha",
          name: "Alpha",
          path: "/alpha",
          status: "idle",
          isActive: true,
          threadTabs: [
            { id: "t-1", title: "Telegram Chat", status: "idle", hasUnreadCompletion: false },
            { id: "t-2", title: "Other Chat", status: "idle", hasUnreadCompletion: false },
          ],
        },
      ],
    })
  );

  assert.match(html, /class="telegram-thread-badge"[^>]*title="Connected to Telegram"/);
  assert.equal((html.match(/class="telegram-thread-badge"/g) || []).length, 1);
  assert.ok(
    html.indexOf("telegram-thread-badge") < html.indexOf("Telegram Chat"),
    "Telegram badge should render before the connected thread title"
  );
});

test("기본 프로젝트 행 렌더", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarProjectsPanel, {
      ...BASE_PROPS,
      projectRows: [
        { type: "project", key: "alpha", name: "Alpha Project", path: "/alpha", isDefault: true },
      ],
    })
  );

  assert.match(html, /project-flat-item/);
  assert.match(html, /Alpha Project/);
  assert.match(html, /project-base-name/);
  assert.match(html, /project-badge-d/);
});

test("열린 세션 행 렌더", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarProjectsPanel, {
      ...BASE_PROPS,
      projectRows: [
        {
          type: "session",
          projectTabId: "project:alpha",
          key: "alpha",
          name: "Alpha Session",
          path: "/alpha",
          status: "idle",
          isActive: true,
          threadTabs: [],
        },
      ],
    })
  );

  assert.match(html, /project-session-row/);
  assert.match(html, /Alpha Session/);
  assert.match(html, /aria-expanded/);
});

test("동일 프로젝트 복수 세션 DOM 렌더", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarProjectsPanel, {
      ...BASE_PROPS,
      projectRows: [
        {
          type: "session",
          projectTabId: "project:alpha:1",
          key: "alpha",
          name: "Alpha Session 1",
          path: "/alpha",
          status: "idle",
          isActive: false,
          threadTabs: [],
        },
        {
          type: "session",
          projectTabId: "project:alpha:2",
          key: "alpha",
          name: "Alpha Session 2",
          path: "/alpha",
          status: "idle",
          isActive: true,
          threadTabs: [],
        },
      ],
    })
  );

  assert.match(html, /Alpha Session 1/);
  assert.match(html, /Alpha Session 2/);
});

test("활성 세션은 최초 렌더에서 펼쳐진다", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarProjectsPanel, {
      ...BASE_PROPS,
      projectRows: [
        {
          type: "session",
          projectTabId: "project:alpha",
          key: "alpha",
          name: "Alpha",
          path: "/alpha",
          status: "idle",
          isActive: true,
          threadTabs: [{ id: "t-1", title: "Chat One", status: "idle", hasUnreadCompletion: false }],
        },
      ],
    })
  );

  assert.match(html, /Chat One/);
});

test("비활성 세션은 최초 렌더에서 접혀 있다", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarProjectsPanel, {
      ...BASE_PROPS,
      projectRows: [
        {
          type: "session",
          projectTabId: "project:alpha",
          key: "alpha",
          name: "Alpha",
          path: "/alpha",
          status: "idle",
          isActive: false,
          threadTabs: [{ id: "t-1", title: "Hidden Chat", status: "idle", hasUnreadCompletion: false }],
        },
      ],
    })
  );

  assert.doesNotMatch(html, /Hidden Chat/);
});

test("이름 버튼과 화살표 토글 버튼이 분리된다", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarProjectsPanel, {
      ...BASE_PROPS,
      projectRows: [
        {
          type: "session",
          projectTabId: "project:alpha",
          key: "alpha",
          name: "Alpha",
          path: "/alpha",
          status: "idle",
          isActive: false,
          threadTabs: [],
        },
      ],
    })
  );

  assert.match(html, /project-session-name/);
  assert.match(html, /project-session-toggle/);
});

test("세션 헤더에 더보기와 새 채팅 작업이 표시된다", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarProjectsPanel, {
      ...BASE_PROPS,
      projectRows: [
        {
          type: "session",
          projectTabId: "project:alpha",
          key: "alpha",
          name: "Alpha Project",
          path: "/alpha",
          status: "idle",
          isActive: false,
          threadTabs: [],
        },
      ],
    })
  );

  assert.match(html, /aria-label="More options"/);
  assert.match(html, /aria-label="New chat"/);
  assert.doesNotMatch(html, /Close project/);
});

test("세션별 채팅 목록이 격리된다", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarProjectsPanel, {
      ...BASE_PROPS,
      projectRows: [
        {
          type: "session",
          projectTabId: "project:alpha",
          key: "alpha",
          name: "Alpha",
          path: "/alpha",
          status: "idle",
          isActive: true,
          threadTabs: [{ id: "t-a", title: "Alpha Chat", status: "idle", hasUnreadCompletion: false }],
        },
        {
          type: "session",
          projectTabId: "project:bravo",
          key: "bravo",
          name: "Bravo",
          path: "/bravo",
          status: "idle",
          isActive: false,
          threadTabs: [{ id: "t-b", title: "Bravo Chat", status: "idle", hasUnreadCompletion: false }],
        },
      ],
    })
  );

  assert.match(html, /Alpha Chat/);
  assert.doesNotMatch(html, /Bravo Chat/);
});

test("채팅 닫기 버튼에 thread 제목 aria-label이 포함된다", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarProjectsPanel, {
      ...BASE_PROPS,
      projectRows: [
        {
          type: "session",
          projectTabId: "project:alpha",
          key: "alpha",
          name: "Alpha",
          path: "/alpha",
          status: "idle",
          isActive: true,
          threadTabs: [{ id: "t-1", title: "My Chat", status: "idle", hasUnreadCompletion: false }],
        },
      ],
    })
  );

  assert.match(html, /Close thread My Chat/);
});

test("열린 채팅이 없을 때 빈 상태 메시지를 표시한다", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarProjectsPanel, {
      ...BASE_PROPS,
      projectRows: [
        {
          type: "session",
          projectTabId: "project:alpha",
          key: "alpha",
          name: "Alpha",
          path: "/alpha",
          status: "idle",
          isActive: true,
          threadTabs: [],
        },
      ],
    })
  );

  assert.match(html, /No open chats for this project/);
});

test("펼친 세션에 새 채팅 버튼이 표시된다", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarProjectsPanel, {
      ...BASE_PROPS,
      projectRows: [
        {
          type: "session",
          projectTabId: "project:alpha",
          key: "alpha",
          name: "Alpha",
          path: "/alpha",
          status: "idle",
          isActive: true,
          threadTabs: [],
        },
      ],
    })
  );

  assert.match(html, /aria-label="New chat"/);
});

test("프로젝트가 없을 때 빈 상태 메시지를 표시한다", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarProjectsPanel, {
      ...BASE_PROPS,
      projectRows: [],
    })
  );

  assert.match(html, /No projects configured/);
});

test("interaction busy 시 세션 이름 버튼이 비활성화된다", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarProjectsPanel, {
      ...BASE_PROPS,
      interactionBusy: true,
      projectRows: [
        {
          type: "session",
          projectTabId: "project:alpha",
          key: "alpha",
          name: "Alpha",
          path: "/alpha",
          status: "idle",
          isActive: false,
          threadTabs: [],
        },
      ],
    })
  );

  assert.match(html, /Switch unavailable while running/);
});

test("활성 및 unread 프로젝트 세션 상태 클래스를 렌더한다", () => {
  const html = renderToStaticMarkup(
    React.createElement(SidebarProjectsPanel, {
      ...BASE_PROPS,
      projectRows: [
        {
          type: "session",
          projectTabId: "project:alpha",
          key: "alpha",
          name: "Alpha",
          path: "/alpha",
          status: "unread",
          isActive: true,
          threadTabs: [],
        },
      ],
    })
  );

  assert.match(html, /project-session-row state-unread active/);
});
