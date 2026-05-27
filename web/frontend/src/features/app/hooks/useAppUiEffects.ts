import { useEffect } from "react";

export default function useAppUiEffects({
  activeToken,
  workspaceContextQuery,
  api,
  setProjectSuggestions,
  floatingAgentSettings,
  activeAgentSettings,
  setFloatingAgentSettings,
  isProjectModeModalOpen,
  setPendingProjectTarget,
  setIsProjectModeModalOpen,
  sendMessageRef,
  sendMessage,
  startThreadRef,
  startThread,
  closeThreadTabRef,
  closeThreadTab,
  viewThreadRef,
  viewThread,
  selectProjectRef,
  selectProject,
  focusComposerRef,
  focusComposer,
  setInputForActiveThreadRef,
  setInputForActiveThread,
}) {
  useEffect(() => {
    if (!activeToken || activeToken.type !== "project") {
      setProjectSuggestions([]);
      return;
    }
    const prefix = activeToken.query || "";
    {
      const query = new URLSearchParams({ prefix, limit: "200" });
      const ctx = workspaceContextQuery();
      if (ctx) {
        const ctxParams = new URLSearchParams(ctx);
        ctxParams.forEach((value, key) => query.set(key, value));
      }
      api(`/api/workspace/suggestions?${query.toString()}`)
        .then((result) => {
          const items = Array.isArray(result.items) ? result.items : [];
          setProjectSuggestions(items.filter((v) => typeof v === "string" && v));
        })
        .catch(() => {
          setProjectSuggestions([]);
        });
    }
  }, [activeToken?.type, activeToken?.query]);

  useEffect(() => {
    if (floatingAgentSettings && floatingAgentSettings !== activeAgentSettings) {
      setFloatingAgentSettings("");
    }
  }, [activeAgentSettings, floatingAgentSettings]);

  useEffect(() => {
    if (!isProjectModeModalOpen || typeof window === "undefined") {
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setPendingProjectTarget("");
        setIsProjectModeModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isProjectModeModalOpen]);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
    startThreadRef.current = startThread;
    closeThreadTabRef.current = closeThreadTab;
    viewThreadRef.current = viewThread;
    selectProjectRef.current = selectProject;
    focusComposerRef.current = focusComposer;
    setInputForActiveThreadRef.current = setInputForActiveThread;
  });
}
