import { normalizeWorkspacePath, statusPriority } from "../common/utils";

export function buildWorkspaceDirectoryStatus(workspaceStatusItems) {
  const next = {};
  for (const [path, value] of Object.entries(workspaceStatusItems || {})) {
    const item = value as { code?: string } | null;
    const normalizedPath = normalizeWorkspacePath(path);
    const code = item?.code || "";
    if (!normalizedPath || !code) {
      continue;
    }
    const parts = normalizedPath.split("/");
    parts.pop();
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = next[current] || "";
      if (statusPriority(code) > statusPriority(existing)) {
        next[current] = code;
      }
    }
  }
  return next;
}

export function getWorkspaceTreeChildren(item, workspaceTree) {
  if (!item || item.type !== "directory") {
    return [];
  }
  const itemPath = normalizeWorkspacePath(item.path);
  if (Array.isArray(workspaceTree[itemPath])) {
    return workspaceTree[itemPath];
  }
  return Array.isArray(item.children) ? item.children : [];
}

function workspaceItemMatches(item, query) {
  const needle = query.toLowerCase();
  const name = typeof item?.name === "string" ? item.name : "";
  const path = normalizeWorkspacePath(item?.path);
  return name.toLowerCase().includes(needle) || path.toLowerCase().includes(needle);
}

function filterWorkspaceTreePath(path, workspaceTree, query, nextTree, visiting = new Set()) {
  const normalizedPath = normalizeWorkspacePath(path);
  if (visiting.has(normalizedPath)) {
    return [];
  }
  visiting.add(normalizedPath);
  const items = Array.isArray(workspaceTree[normalizedPath]) ? workspaceTree[normalizedPath] : [];
  const filteredItems = [];
  for (const item of items) {
    const itemPath = normalizeWorkspacePath(item?.path);
    const children = item?.type === "directory"
      ? filterWorkspaceTreePath(itemPath, workspaceTree, query, nextTree, visiting)
      : [];
    if (workspaceItemMatches(item, query) || children.length > 0) {
      filteredItems.push(item);
    }
  }
  visiting.delete(normalizedPath);
  nextTree[normalizedPath] = filteredItems;
  return filteredItems;
}

export function filterWorkspaceTree(workspaceTree, query) {
  const normalizedQuery = typeof query === "string" ? query.trim() : "";
  if (!normalizedQuery) {
    return workspaceTree;
  }
  const nextTree = {};
  filterWorkspaceTreePath("", workspaceTree || {}, normalizedQuery, nextTree);
  return nextTree;
}

export function collectCompactWorkspaceEntry({
  item,
  workspaceTree,
  workspaceDirectoryStatus,
  workspaceStatusItems,
  expandedWorkspaceDirs,
}) {
  const segments = [];
  let currentItem = item;
  let currentChildren = getWorkspaceTreeChildren(currentItem, workspaceTree);

  while (currentItem && currentItem.type === "directory") {
    segments.push(currentItem);
    const currentPath = normalizeWorkspacePath(currentItem.path);
    if (Object.prototype.hasOwnProperty.call(expandedWorkspaceDirs, currentPath)) {
      break;
    }
    if (!Array.isArray(currentChildren) || currentChildren.length !== 1) {
      break;
    }
    const nextItem = currentChildren[0];
    if (!nextItem || nextItem.type !== "directory") {
      break;
    }
    currentItem = nextItem;
    currentChildren = getWorkspaceTreeChildren(currentItem, workspaceTree);
  }

  const leafItem = segments[segments.length - 1] || item;
  const leafPath = normalizeWorkspacePath(leafItem.path);
  const leafChildren = getWorkspaceTreeChildren(leafItem, workspaceTree);
  const statusCode = segments.reduce((best, segment) => {
    const segmentPath = normalizeWorkspacePath(segment.path);
    const segmentCode = workspaceDirectoryStatus[segmentPath] || workspaceStatusItems[segmentPath]?.code || "";
    return statusPriority(segmentCode) > statusPriority(best) ? segmentCode : best;
  }, "");

  return {
    leafItem,
    leafPath,
    leafChildren,
    segments,
    statusCode,
    label: segments.map((segment) => segment.name).join("/"),
    isExpanded: !!expandedWorkspaceDirs[leafPath],
  };
}
