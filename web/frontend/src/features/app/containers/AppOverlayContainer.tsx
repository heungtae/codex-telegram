import { Toast } from "../../common/components/ui";
import { ProjectModeModal, ProjectPickerModal } from "../components/ProjectModals";
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
    toastNotification: { message: unknown; type?: string; subtitle?: string } | null;
    setToastNotification: Callback;
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
    <>
      <ProjectModeModal
        isOpen={ui.isProjectModeModalOpen}
        onClose={projectPicker.closeProjectModeModal}
        onChooseProjectClickMode={projectPicker.chooseProjectClickMode}
      />
      <ProjectPickerModal
        isOpen={ui.shortcutModalPage === "project"}
        projectSearchQuery={ui.projectSearchQuery}
        onProjectSearchQueryChange={ui.setProjectSearchQuery}
        filteredProjects={projectPickerView.filteredProjects}
        selectedProjectIndex={ui.selectedProjectIndex}
        onSelectedProjectIndexChange={ui.setSelectedProjectIndex}
        onSelectProject={(projectKey) => projectPicker.selectProjectFromPicker(projectKey).catch(() => {})}
        onClose={projectPicker.closeProjectPickerModal}
      />
      {ui.toastNotification ? (
        <Toast
          message={ui.toastNotification.message}
          variant={(ui.toastNotification.type as "info" | "success" | "error" | "warning") || "info"}
          subtitle={ui.toastNotification.subtitle}
          onClose={() => ui.setToastNotification(null)}
        />
      ) : null}
    </>
  );
}
