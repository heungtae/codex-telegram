import { NotificationIcon, ThemeIcon } from "../../common/components/Icons";
import { IconButton } from "../../common/components/ui";

export default function SidebarHeaderActions({
  turnNotificationEnabled,
  setTurnNotificationEnabled,
  persistTurnNotificationEnabled,
  onToggleTheme,
  theme,
}) {
  return (
    <div className="sidebar-header-row">
      <div className="brand">Codex Web</div>
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
      </div>
    </div>
  );
}
