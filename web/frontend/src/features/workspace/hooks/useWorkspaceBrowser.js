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
  const workspacePath = activeProjectTabPath || sessionWorkspace || "";
  const [workspaceByThreadId, setWorkspaceByThreadId] = useState({});
  const [workspaceTree, setWorkspaceTree] = useState({});
  const [expandedWorkspaceDirs, setExpandedWorkspaceDirs] = useState({ "": true });
  const [workspaceStatus, setWorkspaceStatus] = useState({ is_git: false, items: {} });
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspacePreview, setWorkspacePreview] = useState(null);
  const workspaceTreeRef = useRef({});
  const workspaceByThreadIdRef = useRef({});

  useEffect(() => {
    workspaceTreeRef.current = workspaceTree;
  }, [workspaceTree]);

  useEffect(() => {
    workspaceByThreadIdRef.current = workspaceByThreadId;
  }, [workspaceByThreadId]);

  const ensureWorkspaceBucket = useCallback((threadId) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    if (!normalizedThreadId) {
      return;
    }
    setWorkspaceByThreadId((prev) => {
      const existing = prev[normalizedThreadId];
      if (existing && existing.workspacePath === workspacePath) {
        return prev;
      }
      return { ...prev, [normalizedThreadId]: createEmptyWorkspaceState(workspacePath) };
    });
  }, [workspacePath]);

  const resetWorkspaceBucket = useCallback((threadId) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    if (!normalizedThreadId) {
      return;
    }
    setWorkspaceByThreadId((prev) => ({ ...prev, [normalizedThreadId]: createEmptyWorkspaceState(workspacePath) }));
  }, [workspacePath]);

  const removeWorkspaceBucket = useCallback((threadId) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    if (!normalizedThreadId) {
      return;
    }
    setWorkspaceByThreadId((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, normalizedThreadId)) {
        return prev;
      }
      const next = { ...prev };
      delete next[normalizedThreadId];
      return next;
    });
  }, []);

  const restoreWorkspaceForThread = useCallback((threadId) => {
    const normalizedThreadId = normalizeThreadId(threadId);
    const workspaceState = normalizedThreadId ? workspaceByThreadIdRef.current[normalizedThreadId] : null;
    const shouldRestore = workspaceState && workspaceState.workspacePath === workspacePath;
    const nextState = shouldRestore ? workspaceState : createEmptyWorkspaceState(workspacePath);
    setWorkspaceTree(nextState.tree || {});
    setExpandedWorkspaceDirs(nextState.expandedDirs || { "": true });
    setWorkspaceStatus(nextState.status || { is_git: false, items: {} });
    setWorkspaceError(nextState.error || "");
    setWorkspacePreview(nextState.preview || null);
  }, [workspacePath]);

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
    const { depth = 1, force = false } = options;
    const normalizedPath = normalizeWorkspacePath(path);
    const cachedTree = workspaceTreeRef.current;
    if (!force && cachedTree[normalizedPath]) {
      return cachedTree[normalizedPath];
    }
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
    const items = Array.isArray(result.items) ? result.items : [];
    setWorkspaceTree((prev) => ({ ...prev, [normalizedPath]: items }));
    return items;
  }, [workspaceContextQuery]);

  const loadWorkspaceStatus = useCallback(async () => {
    try {
      const ctx = workspaceContextQuery();
      const result = await api(`/api/workspace/status${ctx ? `?${ctx}` : ""}`);
      setWorkspaceStatus({
        is_git: !!result.is_git,
        items: result && typeof result.items === "object" ? result.items : {},
      });
      setWorkspaceError("");
    } catch (err) {
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
    const threadId = normalizeThreadId(activeThread);
    if (!threadId) {
      return;
    }
    setWorkspaceByThreadId((prev) => ({
      ...prev,
      [threadId]: {
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
      return;
    }
    const activeThreadId = normalizeThreadId(activeThread);
    if (!activeThreadId) {
      setWorkspaceTree({});
      setExpandedWorkspaceDirs({ "": true });
      setWorkspaceStatus({ is_git: false, items: {} });
      setWorkspacePreview(null);
      setWorkspaceError("");
      return;
    }
    ensureWorkspaceBucket(activeThreadId);
    const existing = workspaceByThreadIdRef.current[activeThreadId];
    const hasExistingTree =
      existing &&
      existing.workspacePath === workspacePath &&
      existing.tree &&
      Object.keys(existing.tree).length > 0;
    if (hasExistingTree) {
      return;
    }
    loadWorkspaceTree("", { force: true }).catch((err) => {
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
