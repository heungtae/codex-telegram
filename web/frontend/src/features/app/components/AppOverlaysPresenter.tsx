function AppOverlaysPresenter({ projectModeModal, projectPickerModal, shortcutModal, toastNotification }) {
  return (
    <>
      {projectModeModal}
      {projectPickerModal}
      {shortcutModal}
      {toastNotification ? (
        <div className="toast-notification">
          <span className="toast-message">{toastNotification.message}</span>
        </div>
      ) : null}
    </>
  );
}

export default AppOverlaysPresenter;
