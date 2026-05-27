export function collectWorkspaceRefreshPaths(workspaceTree) {
  const keys = workspaceTree && typeof workspaceTree === "object" ? Object.keys(workspaceTree) : [];
  const ordered = ["", ...keys];
  return [...new Set(ordered)];
}
