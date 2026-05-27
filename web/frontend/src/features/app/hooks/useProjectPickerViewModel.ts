import { useMemo } from "react";

export function filterProjectItems(projectItems, projectSearchQuery) {
  const query = projectSearchQuery.toLowerCase();
  if (!query) {
    return projectItems;
  }
  return projectItems.filter(
    (item) =>
      (item.name && item.name.toLowerCase().includes(query)) ||
      (item.key && item.key.toLowerCase().includes(query))
  );
}

export function createProjectPickerActions({
  setPendingProjectTarget,
  setIsProjectModeModalOpen,
  setShortcutModalPage,
  setProjectSearchQuery,
  selectProject,
}) {
  const closeProjectModeModal = () => {
    setPendingProjectTarget("");
    setIsProjectModeModalOpen(false);
  };

  const closeProjectPickerModal = () => {
    setShortcutModalPage("main");
    setProjectSearchQuery("");
  };

  const selectProjectFromPicker = async (projectKey) => {
    await selectProject(projectKey);
    closeProjectPickerModal();
  };

  return {
    closeProjectModeModal,
    closeProjectPickerModal,
    selectProjectFromPicker,
  };
}

export default function useProjectPickerViewModel({
  projectItems,
  projectSearchQuery,
  setPendingProjectTarget,
  setIsProjectModeModalOpen,
  setShortcutModalPage,
  setProjectSearchQuery,
  selectProject,
}) {
  const filteredProjects = useMemo(
    () => filterProjectItems(projectItems, projectSearchQuery),
    [projectItems, projectSearchQuery]
  );
  const actions = createProjectPickerActions({
    setPendingProjectTarget,
    setIsProjectModeModalOpen,
    setShortcutModalPage,
    setProjectSearchQuery,
    selectProject,
  });

  return {
    filteredProjects,
    ...actions,
  };
}
