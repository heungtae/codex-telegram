import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ChatHeader from "../ChatHeader";

test("ChatHeader renders the active thread title and add action", () => {
  const html = renderToStaticMarkup(
    React.createElement(ChatHeader, {
      activeThreadTitle: "Thread One",
      onContextMenu: () => {},
    })
  );

  assert.match(html, /Thread One/);
  assert.match(html, /class="chat-header"/);
  assert.doesNotMatch(html, /project-tab-chip/);
});

test("ChatHeader attaches the context action to the full header", () => {
  const onContextMenu = () => {};
  const element = ChatHeader({
    activeThreadTitle: "Thread One",
    onContextMenu,
  });

  assert.equal(element.type, "header");
  assert.equal(element.props.onContextMenu, onContextMenu);
  const title = React.Children.toArray(element.props.children)[0];
  assert.equal(title.props.onContextMenu, undefined);
});
