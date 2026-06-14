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

test("project session active and unread states have visual styles", () => {
  assert.match(shellStyles, /\.project-session-row\.active\s*\{/);
  assert.match(shellStyles, /\.project-session-row\.state-unread\s*\{/);
});

test("settings popover is a fixed layer independent of the sidebar", () => {
  const popoverRule = shellStyles.match(
    /\.sidebar-settings-popover\s*\{([\s\S]*?)\n\}/,
  );

  assert.ok(popoverRule, "settings popover styles must exist");
  assert.match(popoverRule[1], /position:\s*fixed/);
  assert.doesNotMatch(popoverRule[1], /right:\s*0/);
});

test("removed sidebar collapse implementation has no source remnants", () => {
  assert.doesNotMatch(iconsSource, /SidebarChevronIcon/);
  assert.doesNotMatch(sidebarContainerTest, /SidebarChevronIcon/);
  assert.doesNotMatch(shellStyles, /\.sidebar-collapse-btn/);
  assert.doesNotMatch(themeStyles, /\.sidebar-collapse-btn/);
  assert.doesNotMatch(responsiveStyles, /\.sidebar-collapse-btn/);
});
