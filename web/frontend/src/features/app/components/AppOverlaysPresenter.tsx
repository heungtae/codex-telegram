import { Toast } from "../../common/components/ui";

function AppOverlaysPresenter({ projectModeModal, projectPickerModal, shortcutModal, toastNotification }) {
  return (
    <>
      {projectModeModal}
      {projectPickerModal}
      {shortcutModal}
      {toastNotification ? <Toast message={toastNotification.message} variant={toastNotification.type || "info"} /> : null}
    </>
  );
}

export default AppOverlaysPresenter;
