export type WorkspaceContextOptions = {
  thread_id?: string;
  project_key?: string;
};

export type LoadWorkspaceTreeOptions = {
  depth?: number;
  force?: boolean;
  requestId?: number;
};

export type WorkspaceTreeResponse = {
  items?: unknown[];
};

export type WorkspaceStatusResponse = {
  is_git?: boolean;
  items?: Record<string, unknown>;
};
