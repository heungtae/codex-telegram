import { useState } from "react";

export function normalizeSessionMode(raw) {
  if (typeof raw !== "string") {
    return "build";
  }
  return raw.trim().toLowerCase() === "plan" ? "plan" : "build";
}

export default function useSessionDomain() {
  const [sessionSummary, setSessionSummary] = useState(null);
  const [collaborationMode, setCollaborationMode] = useState("build");
  const [modeSwitchBusy, setModeSwitchBusy] = useState(false);
  const [approvalItems, setApprovalItems] = useState([]);
  const [approvalBusyId, setApprovalBusyId] = useState(null);
  const [agentConfigs, setAgentConfigs] = useState({});
  const [agentConfigRawEditors, setAgentConfigRawEditors] = useState({});
  const [activeAgentSettings, setActiveAgentSettings] = useState("");
  const [floatingAgentSettings, setFloatingAgentSettings] = useState("");
  const [agentConfigLoading, setAgentConfigLoading] = useState("");
  const [agentConfigSaving, setAgentConfigSaving] = useState("");
  const [agentConfigError, setAgentConfigError] = useState("");

  const actions = {
    setSessionSummary,
    setCollaborationMode,
    setModeSwitchBusy,
    setApprovalItems,
    setApprovalBusyId,
    setAgentConfigs,
    setAgentConfigRawEditors,
    setActiveAgentSettings,
    setFloatingAgentSettings,
    setAgentConfigLoading,
    setAgentConfigSaving,
    setAgentConfigError,
  };

  return {
    sessionSummary,
    collaborationMode,
    modeSwitchBusy,
    approvalItems,
    approvalBusyId,
    agentConfigs,
    agentConfigRawEditors,
    activeAgentSettings,
    floatingAgentSettings,
    agentConfigLoading,
    agentConfigSaving,
    agentConfigError,
    ...actions,
    actions,
  };
}
