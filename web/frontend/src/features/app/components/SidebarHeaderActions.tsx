import { NotificationIcon, SidebarToggleIcon, ThemeIcon } from "../../common/components/Icons";
import { IconButton } from "../../common/components/ui";

export default function SidebarHeaderActions({
  turnNotificationEnabled,
  setTurnNotificationEnabled,
  persistTurnNotificationEnabled,
  onToggleTheme,
  theme,
  onToggleSidebarOpen,
  onToggleSidebarCollapsed,
  isMobileLayout,
}) {
  const logoSrc =
    theme === "dark"
      ? "/assets/assets/codex-telegram-icon-ivory.svg"
      : "/assets/assets/codex-telegram-icon-black.svg";

  return (
    <div className="sidebar-header-row">
      <div className="brand">
        <img className="sidebar-brand-logo" src={logoSrc} alt="" aria-hidden="true" />
        <span>Codex Bridge</span>
      </div>
      <div className="sidebar-top-actions">
        <IconButton
          active={turnNotificationEnabled}
          className={`notify-toggle icon-only ${turnNotificationEnabled ? "on" : "off"}`}
          onClick={() => {
            const next = !turnNotificationEnabled;
            setTurnNotificationEnabled(next);
            persistTurnNotificationEnabled(next);
          }}
          ariaLabel="Toggle turn completion notification"
          title={`Turn notification ${turnNotificationEnabled ? "on" : "off"}`}
        >
          <NotificationIcon enabled={turnNotificationEnabled} />
        </IconButton>
        <IconButton
          className="theme-toggle icon-only"
          onClick={onToggleTheme}
          ariaLabel="Toggle theme"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          <ThemeIcon theme={theme} />
        </IconButton>
        <IconButton
          className="sidebar-toggle-btn icon-only"
          onClick={() =>
            isMobileLayout ? onToggleSidebarOpen(false) : onToggleSidebarCollapsed()
          }
          ariaLabel={isMobileLayout ? "Close sidebar" : "Collapse sidebar"}
          title={isMobileLayout ? "Close sidebar" : "Collapse sidebar"}
        >
          <SidebarToggleIcon collapsed={false} />
        </IconButton>
      </div>
    </div>
  );
}
