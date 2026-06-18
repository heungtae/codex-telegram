import AppFloatingAgentSettingsPane from "../components/AppFloatingAgentSettingsPane";
import {
  useAppDomainsContext,
  useAppPresentationContext,
  useAppRuntimeContext,
} from "../context/AppRuntimeContext";

type Callback = (...args: unknown[]) => void;
type AsyncCallback = (...args: unknown[]) => Promise<unknown>;

type FloatingAgentDomains = {
  session: {
    activeAgentSettings: unknown;
    floatingAgentSettings: unknown;
    agentConfigs: unknown;
    agentConfigRawEditors: unknown;
    setFloatingAgentSettings: Callback;
    setAgentConfigRawEditors: Callback;
    setAgentConfigError: Callback;
  };
};

type FloatingAgentRuntime = {
  agent: {
    loadAgentConfig: AsyncCallback;
    saveAgentSettings: AsyncCallback;
  };
};

type FloatingAgentPresentation = {
  sidebar: {
    settingsBusy: boolean;
  };
};

export default function AppFloatingAgentSettingsContainer() {
  const { session } = useAppDomainsContext<FloatingAgentDomains>();
  const { agent } = useAppRuntimeContext<FloatingAgentRuntime>();
  const { sidebar } = useAppPresentationContext<FloatingAgentPresentation>();

  return (
    <AppFloatingAgentSettingsPane
      activeAgentSettings={session.activeAgentSettings}
      floatingAgentSettings={session.floatingAgentSettings}
      agentConfigs={session.agentConfigs}
      agentConfigRawEditors={session.agentConfigRawEditors}
      settingsBusy={sidebar.settingsBusy}
      setFloatingAgentSettings={session.setFloatingAgentSettings}
      setAgentConfigRawEditors={session.setAgentConfigRawEditors}
      loadAgentConfig={agent.loadAgentConfig}
      saveAgentSettings={agent.saveAgentSettings}
      setAgentConfigError={session.setAgentConfigError}
    />
  );
}
