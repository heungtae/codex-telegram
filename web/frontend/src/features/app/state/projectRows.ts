import type { ProjectTab, ThreadTabRow } from "../hooks/useProjectThreadTabs";

export type ThreadTabViewModel = {
  id: string;
  title: string;
  status: string;
  hasUnreadCompletion: boolean;
};

export type ProjectBaseRow = {
  type: "project";
  key: string;
  name: string;
  path: string;
  isDefault: boolean;
};

export type ProjectSessionRow = {
  type: "session";
  projectTabId: string;
  key: string;
  name: string;
  path: string;
  isDefault: boolean;
  status: string;
  isActive: boolean;
  threadTabs: ThreadTabViewModel[];
};

export type ProjectRow = ProjectBaseRow | ProjectSessionRow;

function resolveThreadTabs(tabs: ThreadTabRow[] | undefined): ThreadTabViewModel[] {
  if (!Array.isArray(tabs)) return [];
  return tabs.map((tab) => ({
    id: tab.id,
    title: tab.title || tab.id,
    status: tab.status,
    hasUnreadCompletion: tab.hasUnreadCompletion,
  }));
}

export function buildProjectRows({
  projectItems,
  projectTabs,
  threadTabsByProjectTabId,
  projectTabStatusById,
  activeProjectTabId,
}: {
  projectItems: Array<{ key: string; name: string; path: string; default?: boolean }>;
  projectTabs: ProjectTab[];
  threadTabsByProjectTabId: Record<string, ThreadTabRow[]>;
  projectTabStatusById: Record<string, string>;
  activeProjectTabId: string;
}): ProjectRow[] {
  const rows: ProjectRow[] = [];
  const processedKeys = new Set<string>();

  for (const item of projectItems) {
    const key = item.key;
    if (!key) continue;
    processedKeys.add(key);

    const openSessions = projectTabs.filter((tab) => tab.key === key);

    if (openSessions.length === 0) {
      rows.push({
        type: "project",
        key,
        name: item.name || key,
        path: item.path,
        isDefault: !!item.default,
      });
    } else {
      for (const tab of openSessions) {
        rows.push({
          type: "session",
          projectTabId: tab.id,
          key: tab.key,
          name: tab.name || tab.key,
          path: tab.path,
          isDefault: !!item.default,
          status: projectTabStatusById[tab.id] ?? "idle",
          isActive: tab.id === activeProjectTabId,
          threadTabs: resolveThreadTabs(threadTabsByProjectTabId[tab.id]),
        });
      }
    }
  }

  for (const tab of projectTabs) {
    if (!processedKeys.has(tab.key)) {
      rows.push({
        type: "session",
        projectTabId: tab.id,
        key: tab.key,
        name: tab.name || tab.key,
        path: tab.path,
        isDefault: false,
        status: projectTabStatusById[tab.id] ?? "idle",
        isActive: tab.id === activeProjectTabId,
        threadTabs: resolveThreadTabs(threadTabsByProjectTabId[tab.id]),
      });
    }
  }

  return rows;
}
