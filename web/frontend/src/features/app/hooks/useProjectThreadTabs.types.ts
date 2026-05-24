export type ProjectTab = {
  id: string;
  key: string;
  name: string;
  path: string;
};

export type ThreadTabRow = {
  id: string;
  title: string;
  status: string;
  hasUnreadCompletion: boolean;
};

export type ThreadTabsByProjectTabId = Record<string, ThreadTabRow[]>;
export type ThreadProjectTabMap = Record<string, string>;

export type UseProjectThreadTabsArgs = {
  projectTabs: ProjectTab[];
  setProjectTabs: (updater: (prev: ProjectTab[]) => ProjectTab[]) => void;
  projectTabSequenceRef: { current: number };
  setThreadTabsByProjectTabId: (updater: (prev: ThreadTabsByProjectTabId) => ThreadTabsByProjectTabId) => void;
  setThreadProjectTabIdByThreadId: (updater: (prev: ThreadProjectTabMap) => ThreadProjectTabMap) => void;
  ensureWorkspaceBucket: (threadId: string) => void;
  setActiveThreadTabIdByProjectTabId: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  activeProjectTabId: string;
  setActiveThread: (threadId: string) => void;
  threadProjectTabIdByThreadIdRef: { current: ThreadProjectTabMap };
  threadTabsByProjectTabId: ThreadTabsByProjectTabId;
  removeWorkspaceBucket: (threadId: string) => void;
  activeThreadTabIdByProjectTabId: Record<string, string>;
  setActiveProjectTabId: (tabId: string) => void;
  setMessages: (messages: unknown[]) => void;
};
