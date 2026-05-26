import { AGENT_CONFIG_DEFS } from "../../common/constants";
import { formatGuardianRulesEditor } from "../../common/utils";

export default function useAgentConfigDomain({
  api,
  activeAgentSettings,
  agentConfigs,
  agentConfigRawEditors,
  agentConfigSaving,
  agentConfigLoading,
  setSessionSummary,
  setAgentConfigs,
  setAgentConfigRawEditors,
  setActiveAgentSettings,
  setFloatingAgentSettings,
  setAgentConfigLoading,
  setAgentConfigSaving,
  setAgentConfigError,
}) {
  const patchSessionAgent = (agentName, enabled) => {
    setSessionSummary((prev) => {
      if (!prev || !Array.isArray(prev.agents)) {
        return prev;
      }
      return {
        ...prev,
        agents: prev.agents.map((agent) => (agent.name === agentName ? { ...agent, enabled } : agent)),
      };
    });
  };

  const syncAgentConfig = (agentName, config, syncRulesEditor = true) => {
    setAgentConfigs((prev) => ({ ...prev, [agentName]: config }));
    if (agentName === "guardian" && syncRulesEditor) {
      setAgentConfigRawEditors((prev) => ({
        ...prev,
        [agentName]: formatGuardianRulesEditor(config),
      }));
    }
  };

  const loadAgentConfig = async (agentName, options: { syncRulesEditor?: boolean } = {}) => {
    const { syncRulesEditor = true } = options;
    const def = AGENT_CONFIG_DEFS[agentName];
    if (!def) {
      return null;
    }
    setAgentConfigError("");
    setAgentConfigLoading(agentName);
    try {
      const config = await api(def.path);
      syncAgentConfig(agentName, config, syncRulesEditor);
      return config;
    } finally {
      setAgentConfigLoading((current) => (current === agentName ? "" : current));
    }
  };

  const buildAgentPayload = (agentName, draft, options: { includeRules?: boolean } = {}) => {
    const { includeRules = false } = options;
    if (agentName !== "guardian") {
      return draft;
    }
    const payload = {
      enabled: !!draft.enabled,
      timeout_seconds: Number(draft.timeout_seconds ?? 20),
      failure_policy: String(draft.failure_policy ?? "manual_fallback"),
      explainability: String(draft.explainability ?? "decision_only"),
    };
    if (!includeRules) {
      return payload;
    }
    const rawRules = agentConfigRawEditors[agentName] ?? formatGuardianRulesEditor(draft);
    return { ...payload, rules_toml: rawRules };
  };

  const toggleAgent = async (agentName) => {
    const def = AGENT_CONFIG_DEFS[agentName];
    if (!def || agentConfigSaving || agentConfigLoading) {
      return;
    }
    setAgentConfigError("");
    setAgentConfigSaving(agentName);
    try {
      const current = agentConfigs[agentName] || (await loadAgentConfig(agentName));
      if (!current) {
        return;
      }
      const saved = await api(def.path, {
        method: "POST",
        body: JSON.stringify({ ...current, enabled: !current.enabled }),
      });
      setAgentConfigs((prev) => ({ ...prev, [agentName]: saved }));
      patchSessionAgent(agentName, !!saved.enabled);
    } catch (err) {
      setAgentConfigError(err.message || "Failed to update agent.");
    } finally {
      setAgentConfigSaving("");
    }
  };

  const openAgentSettings = async (agentName) => {
    const def = AGENT_CONFIG_DEFS[agentName];
    if (!def) {
      return;
    }
    if (activeAgentSettings === agentName) {
      setActiveAgentSettings("");
      setFloatingAgentSettings((current) => (current === agentName ? "" : current));
      setAgentConfigError("");
      return;
    }
    setActiveAgentSettings(agentName);
    if (agentName !== "guardian") {
      setFloatingAgentSettings("");
    }
    if (agentConfigs[agentName]) {
      if (agentName === "guardian" && !agentConfigRawEditors[agentName]) {
        setAgentConfigRawEditors((prev) => ({
          ...prev,
          [agentName]: formatGuardianRulesEditor(agentConfigs[agentName]),
        }));
      }
      setAgentConfigError("");
      return;
    }
    try {
      await loadAgentConfig(agentName);
    } catch (err) {
      setAgentConfigError(err.message || "Failed to load settings.");
    }
  };

  const toggleFloatingAgentSettings = (agentName) => {
    if (!agentName || activeAgentSettings !== agentName) {
      return;
    }
    setFloatingAgentSettings((current) => (current === agentName ? "" : agentName));
    setAgentConfigError("");
  };

  const updateAgentDraft = (agentName, key, value) => {
    setAgentConfigs((prev) => ({
      ...prev,
      [agentName]: {
        ...(prev[agentName] || {}),
        [key]: value,
      },
    }));
  };

  const saveAgentSettings = async (
    agentName = activeAgentSettings,
    options: { includeRules?: boolean } = {}
  ) => {
    const { includeRules = agentName === activeAgentSettings && agentName === "guardian" } = options;
    const def = AGENT_CONFIG_DEFS[agentName];
    const draft = agentConfigs[agentName];
    if (!def || !draft || agentConfigSaving || agentConfigLoading) {
      return;
    }
    setAgentConfigError("");
    setAgentConfigSaving(agentName);
    try {
      const payload = buildAgentPayload(agentName, draft, { includeRules });
      const saved = await api(def.path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      syncAgentConfig(agentName, saved, includeRules);
      patchSessionAgent(agentName, !!saved.enabled);
    } catch (err) {
      setAgentConfigError(err.message || "Failed to save settings.");
    } finally {
      setAgentConfigSaving("");
    }
  };

  return {
    loadAgentConfig,
    toggleAgent,
    openAgentSettings,
    toggleFloatingAgentSettings,
    updateAgentDraft,
    saveAgentSettings,
  };
}
