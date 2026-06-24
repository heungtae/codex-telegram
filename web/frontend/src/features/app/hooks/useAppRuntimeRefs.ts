import { useMemo, useRef } from "react";

import useAppCommandRefs from "./useAppCommandRefs";
import {
  WORKSPACE_PREVIEW_DEFAULT_HEIGHT,
  WORKSPACE_PREVIEW_DEFAULT_WIDTH,
} from "./workspacePreviewConstants";

export default function useAppRuntimeRefs() {
  // DOM refs
  const chatRef = useRef(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  // Composer state refs
  const pendingComposerFocusRef = useRef(false);
  const composerFocusWantedRef = useRef(false);
  const composerSelectionRef = useRef<{ start: number | null; end: number | null }>({ start: null, end: null });
  const recentBackspaceAtRef = useRef(0);
  const inputHistoryIndexRef = useRef(-1);

  // Active context refs (kept in sync with state for use in closures)
  const activeProjectTabIdRef = useRef("");
  const activeProjectKeyRef = useRef("");
  const threadProjectTabIdByThreadIdRef = useRef<Record<string, string>>({});

  // Turn/stream tracking refs
  const reasoningStateRef = useRef<Record<string, unknown>>({});
  const streamedTurnIdsRef = useRef<Record<string, boolean>>({});
  const assistantItemCompletedByTurnRef = useRef<Record<string, boolean>>({});
  const itemPhaseByTurnRef = useRef<Record<string, string>>({});

  // Session refs
  const initialLoadRef = useRef(true);
  const projectTabSequenceRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interruptedThreadIdRef = useRef("");

  // Resize refs
  const workspaceResizeRef = useRef({ startX: 0, startWidth: 320 });
  const workspacePreviewResizeRef = useRef({
    mode: "",
    startX: 0,
    startY: 0,
    startWidth: WORKSPACE_PREVIEW_DEFAULT_WIDTH,
    startHeight: WORKSPACE_PREVIEW_DEFAULT_HEIGHT,
  });

  // Command refs (stable function pointers for external callers)
  const commandRefs = useAppCommandRefs();

  return useMemo(() => ({
    chatRef,
    inputRef,
    paletteRef,
    pendingComposerFocusRef,
    composerFocusWantedRef,
    composerSelectionRef,
    recentBackspaceAtRef,
    inputHistoryIndexRef,
    activeProjectTabIdRef,
    activeProjectKeyRef,
    threadProjectTabIdByThreadIdRef,
    reasoningStateRef,
    streamedTurnIdsRef,
    assistantItemCompletedByTurnRef,
    itemPhaseByTurnRef,
    initialLoadRef,
    projectTabSequenceRef,
    audioCtxRef,
    toastTimerRef,
    interruptedThreadIdRef,
    workspaceResizeRef,
    workspacePreviewResizeRef,
    commandRefs,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
}
