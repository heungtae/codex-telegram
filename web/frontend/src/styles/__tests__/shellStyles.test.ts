import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shellStyles = readFileSync(
  new URL("../_shell.scss", import.meta.url),
  "utf8",
);
const themeStyles = readFileSync(
  new URL("../_themes.scss", import.meta.url),
  "utf8",
);
const responsiveStyles = readFileSync(
  new URL("../_responsive.scss", import.meta.url),
  "utf8",
);
const authStyles = readFileSync(
  new URL("../_auth-approvals.scss", import.meta.url),
  "utf8",
);
const foundationStyles = readFileSync(
  new URL("../_foundation.scss", import.meta.url),
  "utf8",
);
const overlayStyles = readFileSync(
  new URL("../_overlays.scss", import.meta.url),
  "utf8",
);
const blackBrandIcon = readFileSync(
  new URL("../../../static/assets/codex-telegram-icon-black.svg", import.meta.url),
  "utf8",
);
const iconsSource = readFileSync(
  new URL("../../features/common/components/Icons.tsx", import.meta.url),
  "utf8",
);
const sidebarContainerTest = readFileSync(
  new URL(
    "../../features/app/containers/__tests__/AppSidebarContainer.test.ts",
    import.meta.url,
  ),
  "utf8",
);

test("project session states color only the folder and title", () => {
  assert.match(shellStyles, /\.project-session-row\.active\s*\{/);
  for (const [state, color] of [
    ["running", "var\\(--accent\\)"],
    ["unread", "#48b46f"],
    ["failed", "#e05c5c"],
    ["cancelled", "var\\(--muted\\)"],
  ]) {
    assert.match(
      shellStyles,
      new RegExp(`\\.project-session-row\\.state-${state} \\.project-session-name svg\\s*\\{[\\s\\S]*?color:\\s*${color}`),
    );
    assert.match(
      shellStyles,
      new RegExp(`\\.project-session-row\\.state-${state} \\.project-session-title\\s*\\{[\\s\\S]*?color:\\s*${color}`),
    );
  }

  assert.doesNotMatch(
    shellStyles,
    /\.project-session-row\.state-(?:unread|failed|cancelled)\s*\{[\s\S]*?border-left-color:/,
  );
  assert.match(
    shellStyles,
    /\.project-session-row\.state-unread\s*\{[\s\S]*?font-weight:\s*600/,
  );
});

test("thread states color only the thread title", () => {
  for (const [state, color] of [
    ["running", "var\\(--accent\\)"],
    ["completed", "#48b46f"],
    ["failed", "#dd5d67"],
    ["cancelled", "#e39e4f"],
  ]) {
    assert.match(
      shellStyles,
      new RegExp(`\\.thread-tab-item\\.state-${state} \\.session-tab-title\\s*\\{[\\s\\S]*?color:\\s*${color}`),
    );
  }

  assert.doesNotMatch(
    shellStyles,
    /\.thread-tab-item\.state-(?:completed|failed|cancelled)\s*\{[\s\S]*?border-left-color:/,
  );
  assert.match(shellStyles, /\.thread-tab-item\.unread\s*\{[\s\S]*?font-weight:\s*600/);
});

test("settings popover is a fixed layer independent of the sidebar", () => {
  const popoverRule = shellStyles.match(
    /\.sidebar-settings-popover\s*\{([\s\S]*?)\n\}/,
  );

  assert.ok(popoverRule, "settings popover styles must exist");
  assert.match(popoverRule[1], /position:\s*fixed/);
  assert.match(popoverRule[1], /border-radius:\s*10px/);
  assert.doesNotMatch(popoverRule[1], /right:\s*0/);
});

test("enabled agents list has a bottom divider", () => {
  const enabledAgentsRule = shellStyles.match(
    /\.enabled-agents-list\s*\{([\s\S]*?)\n\}/,
  );

  assert.ok(enabledAgentsRule, "enabled agents divider styles must exist");
  assert.match(enabledAgentsRule[1], /border-bottom:\s*1px solid var\(--border\)/);
});

test("running subagents use a flat list with a status-only accent", () => {
  const sectionRule = shellStyles.match(
    /\.running-subagents-section\s*\{([\s\S]*?)\n\}/,
  );
  const itemRule = shellStyles.match(
    /\.running-subagent-item\s*\{([\s\S]*?)\n\}/,
  );
  const statusDotRule = shellStyles.match(
    /\.running-subagent-status-dot\s*\{([\s\S]*?)\n\}/,
  );

  assert.ok(sectionRule, "running subagents section styles must exist");
  assert.match(sectionRule[1], /border-bottom:\s*1px solid var\(--border\)/);
  assert.ok(itemRule, "running subagent item styles must exist");
  assert.match(itemRule[1], /background:\s*transparent/);
  assert.doesNotMatch(itemRule[1], /border:/);
  assert.ok(statusDotRule, "running subagent status dot styles must exist");
  assert.match(statusDotRule[1], /background:\s*var\(--success\)/);
});

test("login brand icon is 48px square", () => {
  const iconRule = authStyles.match(
    /\.login-brand-icon\s*\{([\s\S]*?)\n\}/,
  );

  assert.ok(iconRule, "login brand icon styles must exist");
  assert.match(iconRule[1], /width:\s*48px/);
  assert.match(iconRule[1], /height:\s*48px/);
});

test("light theme brand icon matches the login title color", () => {
  assert.match(blackBrandIcon, /fill="#201D1D"/);
});

test("login layout splits the form and illustration evenly", () => {
  const loginRule = authStyles.match(/\.login\s*\{([\s\S]*?)\n\}/);
  const sharedPanelRule = authStyles.match(
    /\.login-form-panel,\s*\n\.login-visual-panel\s*\{([\s\S]*?)\n\}/,
  );
  const formPanelRule = authStyles.match(
    /\.login-form-panel\s*\{([\s\S]*?)\n\}/,
  );
  const visualPanelRules = [
    ...authStyles.matchAll(/\.login-visual-panel\s*\{([\s\S]*?)\n\}/g),
  ];
  const visualPanelRule = visualPanelRules[visualPanelRules.length - 1];
  const visualImageRule = authStyles.match(
    /\.login-visual-image\s*\{([\s\S]*?)\n\}/,
  );

  assert.ok(loginRule, "login layout styles must exist");
  assert.match(loginRule[1], /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.ok(sharedPanelRule, "shared login panel styles must exist");
  assert.match(sharedPanelRule[1], /align-items:\s*center/);
  assert.match(sharedPanelRule[1], /justify-content:\s*center/);
  assert.ok(formPanelRule, "login form panel styles must exist");
  assert.match(formPanelRule[1], /padding:\s*24px/);
  assert.ok(visualPanelRule, "login visual panel styles must exist");
  assert.match(visualPanelRule[1], /background:\s*#faf8f4/i);
  assert.ok(visualImageRule, "login visual image styles must exist");
  assert.match(visualImageRule[1], /width:\s*80%/);
  assert.match(visualImageRule[1], /height:\s*80%/);
  assert.match(visualImageRule[1], /object-fit:\s*contain/);
});

test("mobile login hides the illustration and expands the form panel", () => {
  const mobileRule = responsiveStyles.match(
    /@media \(max-width:\s*900px\)\s*\{([\s\S]*)\n\}/,
  );

  assert.ok(mobileRule, "mobile responsive styles must exist");
  assert.match(mobileRule[1], /\.login\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(mobileRule[1], /\.login-visual-panel\s*\{[\s\S]*display:\s*none/);
});

test("inputs keep focus backgrounds without focus borders or outlines", () => {
  const loginFocusRule = authStyles.match(
    /\.login-card input:focus\s*\{([\s\S]*?)\n\}/,
  );
  const sharedInputFocusRules = [
    ...overlayStyles.matchAll(
      /\.ui-input:focus,[\s\S]*?\.project-picker-input:focus\s*\{([\s\S]*?)\n\}/g,
    ),
  ];
  const sharedInputFocusRule =
    sharedInputFocusRules[sharedInputFocusRules.length - 1];
  const themeInputFocusRule = themeStyles.match(
    /\.ui-input:focus,\s*\n\s*\.project-picker-input:focus,\s*\n\s*\.login-card input:focus\s*\{([\s\S]*?)\n\s*\}/,
  );
  const textareaSelectFocusRules = [
    ...overlayStyles.matchAll(
      /\.ui-textarea:focus,\s*\n\.ui-select:focus\s*\{([\s\S]*?)\n\}/g,
    ),
  ];
  const textareaSelectFocusRule =
    textareaSelectFocusRules[textareaSelectFocusRules.length - 1];

  const inputOutlineRule = foundationStyles.match(
    /input:focus,\s*\ninput:focus-visible\s*\{([\s\S]*?)\n\}/,
  );
  assert.ok(inputOutlineRule, "global input focus reset must exist");
  assert.match(inputOutlineRule[1], /outline:\s*none/);
  assert.doesNotMatch(
    foundationStyles,
    /button:focus-visible,\s*\ninput:focus-visible,/,
  );
  assert.ok(loginFocusRule, "login input focus styles must exist");
  assert.match(loginFocusRule[1], /background:\s*var\(--panel\)/);
  assert.doesNotMatch(loginFocusRule[1], /border-color/);
  assert.doesNotMatch(loginFocusRule[1], /outline/);
  assert.ok(sharedInputFocusRule, "shared input focus styles must exist");
  assert.match(sharedInputFocusRule[1], /background:\s*var\(--panel\)/);
  assert.doesNotMatch(sharedInputFocusRule[1], /border-color/);
  assert.doesNotMatch(sharedInputFocusRule[1], /outline/);
  assert.ok(themeInputFocusRule, "theme input focus styles must exist");
  assert.match(themeInputFocusRule[1], /background:\s*var\(--panel\)/);
  assert.doesNotMatch(themeInputFocusRule[1], /border-color/);
  assert.ok(textareaSelectFocusRule, "textarea and select focus styles must exist");
  assert.match(textareaSelectFocusRule[1], /border-color:\s*var\(--text\)/);
});

test("removed sidebar collapse implementation has no source remnants", () => {
  assert.doesNotMatch(iconsSource, /SidebarChevronIcon/);
  assert.doesNotMatch(sidebarContainerTest, /SidebarChevronIcon/);
  assert.doesNotMatch(shellStyles, /\.sidebar-collapse-btn/);
  assert.doesNotMatch(themeStyles, /\.sidebar-collapse-btn/);
  assert.doesNotMatch(responsiveStyles, /\.sidebar-collapse-btn/);
});
