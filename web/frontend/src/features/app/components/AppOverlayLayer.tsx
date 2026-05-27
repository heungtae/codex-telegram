import AppOverlaysPresenter from "./AppOverlaysPresenter";
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
    <AppOverlaysPresenter
      projectModeModal={
        <ProjectModeModal
          isOpen={isProjectModeModalOpen}
          onClose={onCloseProjectModeModal}
          onChooseProjectClickMode={onChooseProjectClickMode}
        />
      }
      projectPickerModal={
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
      }
      shortcutModal={null}
      toastNotification={toastNotification}
    />
  );
}
