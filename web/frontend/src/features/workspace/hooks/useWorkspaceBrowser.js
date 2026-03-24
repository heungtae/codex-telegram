import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../../common/api";
import {
  createEmptyWorkspaceState,
  normalizeThreadId,
  normalizeWorkspacePath,
} from "../../common/utils";

export default function useWorkspaceBrowser({
  activeThread,
  activeProjectTabId,
  activeProjectKey,
  threadProjectTabIdByThreadId,
  activeProjectTabPath,
  sessionWorkspace,
}) {
  const WORKSPACE_TREE_LOAD_DEPTH = 4;
  const workspacePath = activeProjectTabPath || sessionWorkspace || "";
  const [workspaceByThreadId, setWorkspaceByThreadId] = useState({});
  const [workspaceTree, setWorkspaceTree] = useState({});
  const [expandedWorkspaceDirs, setExpandedWorkspaceDirs] = useState({ "": true });
  const [workspaceStatus, setWorkspaceStatus] = useState({ is_git: false, items: {} });
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspacePreview, setWorkspacePreview] = useState(null);
  const workspaceTreeRef = useRef({});
  const workspaceByThreadIdRef = useRef({});
  const workspaceLoadedPathRef = useRef("");
  const workspaceContextKeyRef = useRef("");
  const workspaceLoadRequestRef = useRef(0);

  useEffect(() => {
    workspaceTreeRef.current = workspaceTree;
  }, [workspaceTree]);

  useEffect(() => {
    workspaceByThreadIdRef.current = workspaceByThreadId;
  }, [workspaceByThreadId]);

  const resolveWorkspaceStateId = useCallback((threadId = "") => {
    const normalizedThreadId = normalizeThreadId(threadId);
    if (normalizedThreadId) {
      return normalizedThreadId;
    }
    if (activeProjectTabId) {
      return `project:${activeProjectTabId}`;
    }
    if (workspacePath) {
      return `workspace:${workspacePath}`;
    }
    return "";
  }, [activeProjectTabId, workspacePath]);

  const ensureWorkspaceBucket = useCallback((threadId) => {
    const stateId = resolveWorkspaceStateId(threadId);
    if (!stateId) {
      return;
    }
    setWorkspaceByThreadId((prev) => {
      const existing = prev[stateId];
      if (existing && existing.workspacePath === workspacePath) {
        return prev;
      }
      return { ...prev, [stateId]: createEmptyWorkspaceState(workspacePath) };
    });
  }, [resolveWorkspaceStateId, workspacePath]);

  const resetWorkspaceBucket = useCallback((threadId) => {
    const stateId = resolveWorkspaceStateId(threadId);
    if (!stateId) {
      return;
    }
    setWorkspaceByThreadId((prev) => ({ ...prev, [stateId]: createEmptyWorkspaceState(workspacePath) }));
  }, [resolveWorkspaceStateId, workspacePath]);

  const removeWorkspaceBucket = useCallback((threadId) => {
    const stateId = resolveWorkspaceStateId(threadId);
    if (!stateId) {
      return;
    }
    setWorkspaceByThreadId((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, stateId)) {
        return prev;
      }
      const next = { ...prev };
      delete next[stateId];
      return next;
    });
  }, [resolveWorkspaceStateId]);

  const restoreWorkspaceForThread = useCallback((threadId) => {
    const stateId = resolveWorkspaceStateId(threadId);
    const workspaceState = stateId ? workspaceByThreadIdRef.current[stateId] : null;
    const shouldRestore = workspaceState && workspaceState.workspacePath === workspacePath;
    const nextState = shouldRestore ? workspaceState : createEmptyWorkspaceState(workspacePath);
    workspaceLoadedPathRef.current = shouldRestore ? workspaceState.workspacePath : "";
    setWorkspaceTree(nextState.tree || {});
    setExpandedWorkspaceDirs(nextState.expandedDirs || { "": true });
    setWorkspaceStatus(nextState.status || { is_git: false, items: {} });
    setWorkspaceError(nextState.error || "");
    setWorkspacePreview(nextState.preview || null);
  }, [resolveWorkspaceStateId, workspacePath]);

  const workspaceContextQuery = useCallback((extra = {}) => {
    const params = new URLSearchParams();
    const explicitThreadId = normalizeThreadId(extra.thread_id || "");
    let threadId = explicitThreadId || normalizeThreadId(activeThread);
    if (!explicitThreadId && threadId && activeProjectTabId) {
      const ownerProjectTabId = threadProjectTabIdByThreadId[threadId];
      if (ownerProjectTabId && ownerProjectTabId !== activeProjectTabId) {
        threadId = "";
      }
    }
    const projectKey = typeof extra.project_key === "string" && extra.project_key
      ? extra.project_key
      : activeProjectKey;
    if (threadId) {
      params.set("thread_id", threadId);
    } else if (projectKey) {
      params.set("project_key", projectKey);
    }
    return params.toString();
  }, [activeProjectKey, activeProjectTabId, activeThread, threadProjectTabIdByThreadId]);

  const loadWorkspaceTree = useCallback(async (path = "", options = {}) => {
    const {
      depth = WORKSPACE_TREE_LOAD_DEPTH,
      force = false,
      requestId = workspaceLoadRequestRef.current,
    } = options;
    const normalizedPath = normalizeWorkspacePath(path);
    const cachedTree = workspaceTreeRef.current;
    if (!force && cachedTree[normalizedPath]) {
      return cachedTree[normalizedPath];
    }
    try {
      const query = new URLSearchParams({
        path: normalizedPath,
        depth: String(depth),
      });
      const ctx = workspaceContextQuery();
      if (ctx) {
        const ctxParams = new URLSearchParams(ctx);
        ctxParams.forEach((value, key) => query.set(key, value));
      }
      const result = await api(`/api/workspace/tree?${query.toString()}`);
      if (requestId !== workspaceLoadRequestRef.current) {
        return [];
      }
      const items = Array.isArray(result.items) ? result.items : [];
      workspaceLoadedPathRef.current = workspacePath;
      setWorkspaceTree((prev) => ({ ...prev, [normalizedPath]: items }));
      return items;
    } catch (err) {
      if (requestId !== workspaceLoadRequestRef.current) {
        return [];
      }
      throw err;
    }
  }, [workspaceContextQuery]);

  const loadWorkspaceStatus = useCallback(async () => {
    const requestId = workspaceLoadRequestRef.current;
    try {
      const ctx = workspaceContextQuery();
      const result = await api(`/api/workspace/status${ctx ? `?${ctx}` : ""}`);
      if (requestId !== workspaceLoadRequestRef.current) {
        return null;
      }
      setWorkspaceStatus({
        is_git: !!result.is_git,
        items: result && typeof result.items === "object" ? result.items : {},
      });
      workspaceLoadedPathRef.current = workspacePath;
      setWorkspaceError("");
    } catch (err) {
      if (requestId !== workspaceLoadRequestRef.current) {
        return null;
      }
      setWorkspaceStatus({ is_git: false, items: {} });
      setWorkspaceError(err.message || "Failed to load workspace status.");
    }
  }, [workspaceContextQuery]);

  const openWorkspaceFile = useCallback(async (path, statusCode = "") => {
    const normalizedPath = normalizeWorkspacePath(path);
    if (!normalizedPath) {
      return;
    }
    setWorkspaceError("");
    setWorkspacePreview({
      path: normalizedPath,
      mode: statusCode ? "diff" : "file",
      status: statusCode,
      loading: true,
      content: "",
      diff: "",
      previewAvailable: true,
      error: "",
      truncated: false,
      isBinary: false,
    });
    try {
      if (statusCode) {
        const diffQuery = new URLSearchParams({ path: normalizedPath });
        const ctx = workspaceContextQuery();
        if (ctx) {
          const ctxParams = new URLSearchParams(ctx);
          ctxParams.forEach((value, key) => diffQuery.set(key, value));
        }
        const diffResult = await api(`/api/workspace/diff?${diffQuery.toString()}`);
        if (diffResult.has_diff && diffResult.diff) {
          setWorkspacePreview({
            path: normalizedPath,
            mode: "diff",
            status: diffResult.status || statusCode,
            loading: false,
            content: "",
            diff: diffResult.diff,
            previewAvailable: true,
            error: "",
            truncated: false,
            isBinary: false,
          });
          return;
        }
      }
      const fileQuery = new URLSearchParams({ path: normalizedPath });
      const ctx = workspaceContextQuery();
      if (ctx) {
        const ctxParams = new URLSearchParams(ctx);
        ctxParams.forEach((value, key) => fileQuery.set(key, value));
      }
      const fileResult = await api(`/api/workspace/file?${fileQuery.toString()}`);
      setWorkspacePreview({
        path: normalizedPath,
        mode: "file",
        status: statusCode,
        loading: false,
        content: fileResult.content || "",
        diff: "",
        previewAvailable: !!fileResult.preview_available,
        error: "",
        truncated: !!fileResult.truncated,
        isBinary: !!fileResult.is_binary,
      });
    } catch (err) {
      setWorkspacePreview({
        path: normalizedPath,
        mode: statusCode ? "diff" : "file",
        status: statusCode,
        loading: false,
        content: "",
        diff: "",
        previewAvailable: false,
        error: err.message || "Failed to load file preview.",
        truncated: false,
        isBinary: false,
      });
    }
  }, [workspaceContextQuery]);

  const toggleWorkspaceDirectory = useCallback((path) => {
    const normalizedPath = normalizeWorkspacePath(path);
    const isExpanded = !!expandedWorkspaceDirs[normalizedPath];
    if (isExpanded) {
      setExpandedWorkspaceDirs((prev) => ({ ...prev, [normalizedPath]: false }));
      return;
    }
    setExpandedWorkspaceDirs((prev) => ({ ...prev, [normalizedPath]: true }));
    const cachedTree = workspaceTreeRef.current;
    if (!cachedTree[normalizedPath]) {
      loadWorkspaceTree(normalizedPath).catch((err) => {
        setWorkspaceError(err.message || "Failed to load workspace tree.");
      });
    }
  }, [expandedWorkspaceDirs, loadWorkspaceTree]);

  useEffect(() => {
    const stateId = resolveWorkspaceStateId(activeThread);
    if (!stateId) {
      return;
    }
    if (workspaceLoadedPathRef.current !== workspacePath) {
      return;
    }
    setWorkspaceByThreadId((prev) => ({
      ...prev,
      [stateId]: {
        workspacePath,
        tree: workspaceTree,
        expandedDirs: expandedWorkspaceDirs,
        status: workspaceStatus,
        error: workspaceError,
        preview: workspacePreview,
      },
    }));
  }, [
    activeThread,
    workspaceTree,
    expandedWorkspaceDirs,
    workspaceStatus,
    workspaceError,
    workspacePreview,
    workspacePath,
    resolveWorkspaceStateId,
  ]);

  useEffect(() => {
    restoreWorkspaceForThread(activeThread);
  }, [activeThread, workspacePath, restoreWorkspaceForThread]);

  useEffect(() => {
    if (!workspacePath) {
      setWorkspaceTree({});
      setExpandedWorkspaceDirs({ "": true });
      setWorkspaceStatus({ is_git: false, items: {} });
      setWorkspacePreview(null);
      setWorkspaceError("");
      workspaceLoadedPathRef.current = "";
      return;
    }
    const workspaceStateId = resolveWorkspaceStateId(activeThread);
    if (!workspaceStateId) {
      setWorkspaceTree({});
      setExpandedWorkspaceDirs({ "": true });
      setWorkspaceStatus({ is_git: false, items: {} });
      setWorkspacePreview(null);
      setWorkspaceError("");
      workspaceLoadedPathRef.current = "";
      return;
    }
    const workspaceContextKey = `${workspaceStateId}::${workspacePath}`;
    if (workspaceContextKeyRef.current !== workspaceContextKey) {
      workspaceContextKeyRef.current = workspaceContextKey;
      workspaceLoadRequestRef.current += 1;
    }
    ensureWorkspaceBucket(workspaceStateId);
    const existing = workspaceByThreadIdRef.current[workspaceStateId];
    const hasExistingTree =
      existing &&
      existing.workspacePath === workspacePath &&
      existing.tree &&
      Object.keys(existing.tree).length > 0;
    if (hasExistingTree) {
      workspaceLoadedPathRef.current = workspacePath;
      return;
    }
    const requestId = workspaceLoadRequestRef.current;
    loadWorkspaceTree("", { force: true, depth: WORKSPACE_TREE_LOAD_DEPTH, requestId }).catch((err) => {
      setWorkspaceTree({});
      setWorkspaceError(err.message || "Failed to load workspace tree.");
    });
    loadWorkspaceStatus().catch(() => {});
  }, [
    activeProjectTabId,
    activeProjectTabPath,
    sessionWorkspace,
    activeThread,
    workspaceContextQuery,
    loadWorkspaceTree,
    loadWorkspaceStatus,
    ensureWorkspaceBucket,
    workspacePath,
    resolveWorkspaceStateId,
  ]);

  return {
    ensureWorkspaceBucket,
    resetWorkspaceBucket,
    removeWorkspaceBucket,
    restoreWorkspaceForThread,
    workspaceTree,
    expandedWorkspaceDirs,
    workspaceStatus,
    workspaceError,
    setWorkspaceError,
    workspacePreview,
    setWorkspacePreview,
    workspaceContextQuery,
    loadWorkspaceTree,
    loadWorkspaceStatus,
    openWorkspaceFile,
    toggleWorkspaceDirectory,
  };
}
