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
  const [workspaceByProjectTabId, setWorkspaceByProjectTabId] = useState({});
  const [workspaceTree, setWorkspaceTree] = useState({});
  const [expandedWorkspaceDirs, setExpandedWorkspaceDirs] = useState({ "": true });
  const [workspaceStatus, setWorkspaceStatus] = useState({ is_git: false, items: {} });
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspacePreview, setWorkspacePreview] = useState(null);
  const workspaceTreeRef = useRef({});

  useEffect(() => {
    workspaceTreeRef.current = workspaceTree;
  }, [workspaceTree]);

  const ensureWorkspaceBucket = useCallback((projectTabId) => {
    if (!projectTabId) {
      return;
    }
    setWorkspaceByProjectTabId((prev) => {
      if (prev[projectTabId]) {
        return prev;
      }
      return { ...prev, [projectTabId]: createEmptyWorkspaceState() };
    });
  }, []);

  const resetWorkspaceBucket = useCallback((projectTabId) => {
    if (!projectTabId) {
      return;
    }
    setWorkspaceByProjectTabId((prev) => ({ ...prev, [projectTabId]: createEmptyWorkspaceState() }));
  }, []);

  const removeWorkspaceBucket = useCallback((projectTabId) => {
    if (!projectTabId) {
      return;
    }
    removeWorkspaceBucket(projectTabId);
  }, []);

  const restoreWorkspaceForProjectTab = useCallback((projectTabId) => {
    if (!projectTabId) {
      return;
    }
    const workspaceState = workspaceByProjectTabId[projectTabId] || createEmptyWorkspaceState();
    setWorkspaceTree(workspaceState.tree || {});
    setExpandedWorkspaceDirs(workspaceState.expandedDirs || { "": true });
    setWorkspaceStatus(workspaceState.status || { is_git: false, items: {} });
    setWorkspaceError(workspaceState.error || "");
    setWorkspacePreview(workspaceState.preview || null);
  }, [workspaceByProjectTabId]);

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
    if (!activeProjectTabId) {
      return;
    }
    setWorkspaceByProjectTabId((prev) => ({
      ...prev,
      [activeProjectTabId]: {
        tree: workspaceTree,
        expandedDirs: expandedWorkspaceDirs,
        status: workspaceStatus,
        error: workspaceError,
        preview: workspacePreview,
      },
    }));
  }, [
    activeProjectTabId,
    workspaceTree,
    expandedWorkspaceDirs,
    workspaceStatus,
    workspaceError,
    workspacePreview,
  ]);

  useEffect(() => {
    const workspacePath = activeProjectTabPath || sessionWorkspace || "";
    if (!workspacePath) {
      setWorkspaceTree({});
      setWorkspaceStatus({ is_git: false, items: {} });
      setWorkspacePreview(null);
      setWorkspaceError("");
      return;
    }
    setExpandedWorkspaceDirs({ "": true });
    loadWorkspaceTree("", { force: true }).catch((err) => {
      setWorkspaceTree({});
      setWorkspaceError(err.message || "Failed to load workspace tree.");
    });
    loadWorkspaceStatus().catch(() => {});
  }, [activeProjectTabId, activeProjectTabPath, sessionWorkspace, workspaceContextQuery]);

  return {
    ensureWorkspaceBucket,
    resetWorkspaceBucket,
    removeWorkspaceBucket,
    restoreWorkspaceForProjectTab,
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
