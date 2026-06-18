import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import Login from "../Login";

const BASE_PROPS = {
  onLoggedIn: () => {},
  onToggleTheme: () => {},
};

test("Login renders the black brand icon in light theme", () => {
  const html = renderToStaticMarkup(
    React.createElement(Login, { ...BASE_PROPS, theme: "light" }),
  );

  assert.match(
    html,
    /src="\/assets\/assets\/codex-telegram-icon-black\.svg"/,
  );
  assert.doesNotMatch(html, /codex-telegram-icon-ivory\.svg/);
  assert.match(html, /Codex Bridge/);
  assert.match(html, /aria-hidden="true"/);
});

test("Login renders the ivory brand icon in dark theme", () => {
  const html = renderToStaticMarkup(
    React.createElement(Login, { ...BASE_PROPS, theme: "dark" }),
  );

  assert.match(
    html,
    /src="\/assets\/assets\/codex-telegram-icon-ivory\.svg"/,
  );
  assert.doesNotMatch(html, /codex-telegram-icon-black\.svg/);
  assert.match(html, /Codex Bridge/);
});

test("Login renders the decorative illustration in a separate panel", () => {
  const html = renderToStaticMarkup(
    React.createElement(Login, { ...BASE_PROPS, theme: "light" }),
  );

  assert.match(html, /class="login-form-panel"/);
  assert.match(html, /class="login-visual-panel"/);
  assert.match(
    html,
    /src="\/assets\/assets\/codex-telegram-login-image\.png"/,
  );
  assert.match(html, /class="login-visual-image"/);
  assert.match(html, /alt=""/);
  assert.match(html, /aria-hidden="true"/);
});
