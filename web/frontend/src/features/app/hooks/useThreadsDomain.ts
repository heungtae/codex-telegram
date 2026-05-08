import { useState } from "react";

export function resolveThreadFallback(nextRows, closedIndex) {
  if (!Array.isArray(nextRows) || nextRows.length === 0) {
    return null;
  }
  return nextRows[closedIndex] || nextRows[closedIndex - 1] || nextRows[0] || null;
}

export default function useThreadsDomain() {
  const [projectTabs, setProjectTabs] = useState([]);
  const [activeProjectTabId, setActiveProjectTabId] = useState("");
  const [threadTabsByProjectTabId, setThreadTabsByProjectTabId] = useState({});
  const [activeThreadTabIdByProjectTabId, setActiveThreadTabIdByProjectTabId] = useState({});
  const [threadProjectTabIdByThreadId, setThreadProjectTabIdByThreadId] = useState({});
  const [activeThread, setActiveThread] = useState("");
  const [threadItems, setThreadItems] = useState([]);
  const [projectItems, setProjectItems] = useState([]);
  const [projectSuggestions, setProjectSuggestions] = useState([]);
  const [skillSuggestions, setSkillSuggestions] = useState([]);

  const actions = {
    setProjectTabs,
    setActiveProjectTabId,
    setThreadTabsByProjectTabId,
    setActiveThreadTabIdByProjectTabId,
    setThreadProjectTabIdByThreadId,
    setActiveThread,
    setThreadItems,
    setProjectItems,
    setProjectSuggestions,
    setSkillSuggestions,
  };

  return {
    projectTabs,
    activeProjectTabId,
    threadTabsByProjectTabId,
    activeThreadTabIdByProjectTabId,
    threadProjectTabIdByThreadId,
    activeThread,
    threadItems,
    projectItems,
    projectSuggestions,
    skillSuggestions,
    ...actions,
    actions,
  };
}
