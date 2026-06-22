import { Toast } from "../../common/components/ui";
import { ProjectModeModal, ProjectPickerModal } from "./ProjectModals";

export default function AppOverlayLayer({
  isProjectModeModalOpen,
  onCloseProjectModeModal,
  onChooseProjectClickMode,
  isProjectPickerOpen,
  projectSearchQuery,
  onProjectSearchQueryChange,
  filteredProjects,
  selectedProjectIndex,
  onSelectedProjectIndexChange,
  onSelectProject,
  onCloseProjectPicker,
  toastNotification,
}) {
  return (
    <>
      <ProjectModeModal
        isOpen={isProjectModeModalOpen}
        onClose={onCloseProjectModeModal}
        onChooseProjectClickMode={onChooseProjectClickMode}
      />
      <ProjectPickerModal
        isOpen={isProjectPickerOpen}
        projectSearchQuery={projectSearchQuery}
        onProjectSearchQueryChange={onProjectSearchQueryChange}
        filteredProjects={filteredProjects}
        selectedProjectIndex={selectedProjectIndex}
        onSelectedProjectIndexChange={onSelectedProjectIndexChange}
        onSelectProject={onSelectProject}
        onClose={onCloseProjectPicker}
      />
      {null}
      {toastNotification ? <Toast message={toastNotification.message} variant={toastNotification.type || "info"} /> : null}
    </>
  );
}
