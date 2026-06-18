export function createOpenExplorerPayload(projectKey: string) {
  return {
    project_key: projectKey,
  };
}

export async function openProjectInExplorer(projectKey: string, fetchImpl = fetch) {
  if (!projectKey) {
    return;
  }
  await fetchImpl("/api/projects/open-explorer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createOpenExplorerPayload(projectKey)),
  });
}
