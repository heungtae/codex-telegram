import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  useAppDomainsContext,
  useAppPresentationContext,
  useAppRuntimeContext,
} from "../AppRuntimeContext";
import AppRuntimeProvider from "../AppRuntimeProvider";

function SliceConsumer() {
  const domains = useAppDomainsContext<{ name: string }>();
  const runtime = useAppRuntimeContext<{ name: string }>();
  const presentation = useAppPresentationContext<{ name: string }>();
  return React.createElement(
    "span",
    null,
    `${domains.name}:${runtime.name}:${presentation.name}`
  );
}

test("AppRuntimeProvider exposes domain, runtime, and presentation slices", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      AppRuntimeProvider,
      {
        value: {
          domains: { name: "domains" },
          runtime: { name: "runtime" },
          presentation: { name: "presentation" },
        },
      },
      React.createElement(SliceConsumer)
    )
  );

  assert.match(html, /domains:runtime:presentation/);
});

test("AppRuntimeContext hooks fail clearly outside the provider", () => {
  assert.throws(
    () => renderToStaticMarkup(React.createElement(SliceConsumer)),
    /AppRuntimeProvider/
  );
});
