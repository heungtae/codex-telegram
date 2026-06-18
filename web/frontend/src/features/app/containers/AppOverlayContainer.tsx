import AppOverlayLayer from "../components/AppOverlayLayer";
import {
  useAppDomainsContext,
  useAppPresentationContext,
  useAppRuntimeContext,
} from "../context/AppRuntimeContext";

type Callback = (...args: unknown[]) => void;
type AsyncCallback = (...args: unknown[]) => Promise<unknown>;

type OverlayDomains = {
  ui: {
    isProjectModeModalOpen: boolean;
    shortcutModalPage: string;
    projectSearchQuery: string;
    selectedProjectIndex: number;
    toastNotification: unknown;
    setProjectSearchQuery: Callback;
    setSelectedProjectIndex: Callback;
  };
};

type OverlayRuntime = {
  projectPicker: {
    closeProjectModeModal: Callback;
    chooseProjectClickMode: Callback;
    selectProjectFromPicker: AsyncCallback;
    closeProjectPickerModal: Callback;
  };
};

type OverlayPresentation = {
  projectPicker: {
    filteredProjects: unknown;
  };
};

export default function AppOverlayContainer() {
  const { ui } = useAppDomainsContext<OverlayDomains>();
  const { projectPicker } = useAppRuntimeContext<OverlayRuntime>();
  const { projectPicker: projectPickerView } = useAppPresentationContext<OverlayPresentation>();

  return (
    <AppOverlayLayer
      isProjectModeModalOpen={ui.isProjectModeModalOpen}
      onCloseProjectModeModal={projectPicker.closeProjectModeModal}
      onChooseProjectClickMode={projectPicker.chooseProjectClickMode}
      isProjectPickerOpen={ui.shortcutModalPage === "project"}
      projectSearchQuery={ui.projectSearchQuery}
      onProjectSearchQueryChange={ui.setProjectSearchQuery}
      filteredProjects={projectPickerView.filteredProjects}
      selectedProjectIndex={ui.selectedProjectIndex}
      onSelectedProjectIndexChange={ui.setSelectedProjectIndex}
      onSelectProject={(projectKey) => projectPicker.selectProjectFromPicker(projectKey).catch(() => {})}
      onCloseProjectPicker={projectPicker.closeProjectPickerModal}
      toastNotification={ui.toastNotification}
    />
  );
}
