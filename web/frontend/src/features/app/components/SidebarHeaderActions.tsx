import { NotificationIcon, ThemeIcon } from "../../common/components/Icons";

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
        <button
          className={`notify-toggle icon-only ${turnNotificationEnabled ? "on" : "off"}`}
          type="button"
          onClick={() => {
            const next = !turnNotificationEnabled;
            setTurnNotificationEnabled(next);
            persistTurnNotificationEnabled(next);
          }}
          aria-label="Toggle turn completion notification"
          title={`Turn notification ${turnNotificationEnabled ? "on" : "off"}`}
        >
          <NotificationIcon enabled={turnNotificationEnabled} />
        </button>
        <button
          className="theme-toggle icon-only"
          type="button"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          <ThemeIcon theme={theme} />
        </button>
      </div>
    </div>
  );
}
