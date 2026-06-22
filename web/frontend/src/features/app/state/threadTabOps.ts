import { normalizeThreadId } from "../../common/utils";

type ThreadTab = Record<string, unknown>;
type ThreadTabMap = Record<string, ThreadTab[]>;

export function replaceThreadInTab(
  prev: ThreadTabMap,
  projectTabId: string,
  currentThreadId: string,
  nextThreadId: string,
): ThreadTabMap {
  const rows = Array.isArray(prev[projectTabId]) ? prev[projectTabId] : [];
  const index = rows.findIndex(
    (row) => normalizeThreadId(String(row.id ?? "")) === currentThreadId
  );
  if (index < 0) {
    const nextIndex = rows.length + 1;
    return {
      ...prev,
      [projectTabId]: [
        ...rows,
        { id: nextThreadId, title: `New Thread (${nextIndex})`, status: "idle", hasUnreadCompletion: false },
      ],
    };
  }
  const nextRows = [...rows];
  nextRows[index] = {
    ...nextRows[index],
    id: nextThreadId,
    title: `New Thread (${index + 1})`,
    status: "idle",
    hasUnreadCompletion: false,
  };
  return { ...prev, [projectTabId]: nextRows };
}

export function upsertThreadTab(
  prev: ThreadTabMap,
  projectTabId: string,
  threadId: string,
  title: string,
): ThreadTabMap {
  const rows = Array.isArray(prev[projectTabId]) ? prev[projectTabId] : [];
  if (rows.some((row) => normalizeThreadId(String(row?.id ?? "")) === threadId)) {
    return prev;
  }
  return {
    ...prev,
    [projectTabId]: [
      ...rows,
      { id: threadId, title, status: "idle", hasUnreadCompletion: false },
    ],
  };
}

export function removeThreadsOwnedByTab(
  prev: Record<string, string>,
  projectTabId: string,
): Record<string, string> {
  const next = { ...prev };
  for (const [threadId, tabId] of Object.entries(next)) {
    if (tabId === projectTabId) delete next[threadId];
  }
  return next;
}
