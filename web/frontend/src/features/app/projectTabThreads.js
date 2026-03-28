import { normalizeThreadId } from "../common/utils.js";

export function resolveProjectTabThreadId({
  projectTabId,
  activeThreadId = "",
  threadProjectTabIdByThreadId = {},
  activeThreadTabIdByProjectTabId = {},
  threadTabsByProjectTabId = {},
}) {
  const normalizedProjectTabId = normalizeThreadId(projectTabId);
  const normalizedActiveThreadId = normalizeThreadId(activeThreadId);
  if (!normalizedProjectTabId) {
    return normalizedActiveThreadId;
  }

  const selectedThreadId = normalizeThreadId(activeThreadTabIdByProjectTabId[normalizedProjectTabId]) || "";
  if (selectedThreadId) {
    return selectedThreadId;
  }

  const openedThreads = Array.isArray(threadTabsByProjectTabId[normalizedProjectTabId])
    ? threadTabsByProjectTabId[normalizedProjectTabId]
    : [];
  const firstOpenedThreadId = normalizeThreadId(openedThreads[0]?.id) || "";
  if (firstOpenedThreadId) {
    return firstOpenedThreadId;
  }

  if (
    normalizedActiveThreadId &&
    (
      !threadProjectTabIdByThreadId[normalizedActiveThreadId] ||
      threadProjectTabIdByThreadId[normalizedActiveThreadId] === normalizedProjectTabId
    )
  ) {
    return normalizedActiveThreadId;
  }

  return "";
}
