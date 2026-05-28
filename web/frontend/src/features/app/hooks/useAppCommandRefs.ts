import { useMemo, useRef } from "react";

export function createAppCommandRefs() {
  return {
    sendMessage: { current: null },
    startThread: { current: null },
    closeThreadTab: { current: null },
    viewThread: { current: null },
    selectProject: { current: null },
    focusComposer: { current: null },
    setInputForActiveThread: { current: null },
  };
}

export function bindAppCommandRefs(refs, commands) {
  refs.sendMessage.current = commands.sendMessage;
  refs.startThread.current = commands.startThread;
  refs.closeThreadTab.current = commands.closeThreadTab;
  refs.viewThread.current = commands.viewThread;
  refs.selectProject.current = commands.selectProject;
  refs.focusComposer.current = commands.focusComposer;
  refs.setInputForActiveThread.current = commands.setInputForActiveThread;
}

export default function useAppCommandRefs() {
  const sendMessage = useRef(null);
  const startThread = useRef(null);
  const closeThreadTab = useRef(null);
  const viewThread = useRef(null);
  const selectProject = useRef(null);
  const focusComposer = useRef(null);
  const setInputForActiveThread = useRef(null);

  return useMemo(
    () => ({
      sendMessage,
      startThread,
      closeThreadTab,
      viewThread,
      selectProject,
      focusComposer,
      setInputForActiveThread,
    }),
    []
  );
}
