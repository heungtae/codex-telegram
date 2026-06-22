import { useMemo, useState } from "react";
import { buildWorkspaceDirectoryStatus, filterWorkspaceTree } from "../workspaceTreeModel";

export default function useWorkspaceFilter(workspaceTree: Record<string, unknown[]>, workspaceStatusItems: Record<string, unknown>) {
  const [filterQuery, setFilterQuery] = useState("");

  const workspaceDirectoryStatus = useMemo(
    () => buildWorkspaceDirectoryStatus(workspaceStatusItems),
    [workspaceStatusItems]
  );

  const visibleWorkspaceTree = useMemo(
    () => filterWorkspaceTree(workspaceTree, filterQuery),
    [workspaceTree, filterQuery]
  );

  const rootItems = Array.isArray(visibleWorkspaceTree[""]) ? visibleWorkspaceTree[""] : [];

  const deletedWorkspaceEntries = useMemo(
    () =>
      Object.entries(workspaceStatusItems)
        .filter(([path, value]) => {
          const status = value as { code?: string } | null;
          return status?.code === "D" && !workspaceTree[""]?.some((item: { path: string }) => item.path === path);
        })
        .sort((a, b) => a[0].localeCompare(b[0])),
    [workspaceStatusItems, workspaceTree]
  );

  return { filterQuery, setFilterQuery, workspaceDirectoryStatus, visibleWorkspaceTree, rootItems, deletedWorkspaceEntries };
}
