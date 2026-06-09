import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AppRuntimeProvider from "../../context/AppRuntimeProvider";
import AppOverlayContainer from "../AppOverlayContainer";

test("AppOverlayContainer consumes picker and toast slices", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      AppRuntimeProvider,
      {
        value: {
          domains: {
            ui: {
              isProjectModeModalOpen: false,
              shortcutModalPage: "",
              projectSearchQuery: "",
              selectedProjectIndex: 0,
              toastNotification: { message: "Saved", type: "success" },
              setProjectSearchQuery: () => {},
              setSelectedProjectIndex: () => {},
            },
          },
          runtime: {
            projectPicker: {
              closeProjectModeModal: () => {},
              chooseProjectClickMode: () => {},
              selectProjectFromPicker: () => Promise.resolve(),
              closeProjectPickerModal: () => {},
            },
          },
          presentation: {
            projectPicker: {
              filteredProjects: [],
            },
          },
        },
      },
      React.createElement(AppOverlayContainer)
    )
  );

  assert.match(html, /Saved/);
  assert.match(html, /ui-toast-success/);
});
