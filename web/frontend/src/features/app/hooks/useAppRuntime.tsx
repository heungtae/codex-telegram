import useAppComposerRuntime from "./useAppComposerRuntime";
import useAppDomainRuntime from "./useAppDomainRuntime";
import useAppRuntimeEffects from "./useAppRuntimeEffects";
import useAppRuntimePresentation from "./useAppRuntimePresentation";

const SIDEBAR_COLLAPSED_WIDTH = 44;

export default function useAppRuntime({
  me,
  theme,
  onToggleTheme,
  domains,
}) {
  const domainRuntime = useAppDomainRuntime({ me, domains });
  const composerRuntime = useAppComposerRuntime({
    domains,
    domainRuntime,
  });
  const effectsRuntime = useAppRuntimeEffects({
    me,
    domains,
    domainRuntime,
    composerRuntime,
  });

  return useAppRuntimePresentation({
    appVersion: me?.app_version,
    theme,
    onToggleTheme,
    domains,
    domainRuntime,
    composerRuntime,
    effectsRuntime,
    sidebarCollapsedWidth: SIDEBAR_COLLAPSED_WIDTH,
  });
}
