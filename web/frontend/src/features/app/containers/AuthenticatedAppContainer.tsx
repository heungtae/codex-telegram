import AuthenticatedAppLayout from "../components/AuthenticatedAppLayout";
import AppConversationPane from "../components/AppConversationPane";
import AppRuntimeProvider from "../context/AppRuntimeProvider";
import useAppDomains from "../hooks/useAppDomains";
import useAppRuntime from "../hooks/useAppRuntime";
import AppFloatingAgentSettingsContainer from "./AppFloatingAgentSettingsContainer";
import AppOverlayContainer from "./AppOverlayContainer";
import AppSidebarContainer from "./AppSidebarContainer";

function AuthenticatedAppContainer({ me, theme, onToggleTheme }) {
  const domains = useAppDomains();
  const { contextValue, conversation, layout } = useAppRuntime({
    me,
    theme,
    onToggleTheme,
    domains,
  });

  return (
    <AppRuntimeProvider value={contextValue}>
      <AuthenticatedAppLayout
        isMobileLayout={layout.isMobileLayout}
        overlays={<AppOverlayContainer />}
        sidebar={<AppSidebarContainer />}
        main={
          <>
            <AppFloatingAgentSettingsContainer />
            <AppConversationPane {...conversation} />
          </>
        }
        isSidebarOpen={layout.isSidebarOpen}
        onToggleSidebarOpen={layout.onToggleSidebarOpen}
        MenuIcon={layout.MenuIcon}
      />
    </AppRuntimeProvider>
  );
}

export default AuthenticatedAppContainer;
