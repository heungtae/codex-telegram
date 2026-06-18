import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeTheme,
  readDocumentTheme,
} from "../theme";

test("normalizeTheme defaults unknown values to light", () => {
  assert.equal(normalizeTheme(undefined), "light");
  assert.equal(normalizeTheme("system"), "light");
});

test("readDocumentTheme restores a persisted dark theme", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { documentElement: { dataset: { theme: "light" } } },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => "dark",
      },
    },
  });

  try {
    assert.equal(readDocumentTheme(), "dark");
  } finally {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
});
