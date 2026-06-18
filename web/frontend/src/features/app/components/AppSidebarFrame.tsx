import { useEffect, useId, useRef, useState } from "react";

import { SettingsIcon, SidebarToggleIcon } from "../../common/components/Icons";
import {
  resolveSettingsButtonAction,
  resolveSettingsPopoverPosition,
} from "../state/settingsPopover.js";

export default function AppSidebarFrame({
  children,
  isMobileLayout,
  isSidebarOpen,
  isDesktopSidebarCollapsed,
  sidebarStyle,
  isResizingSidebar,
  onToggleSidebarOpen,
  onToggleSidebarCollapsed,
  onStartSidebarResize,
  settingsContent,
  defaultSettingsOpen = false,
}) {
  const [settingsOpen, setSettingsOpen] = useState(defaultSettingsOpen);
  const panelId = useId();
  const panelRef = useRef(null);
  const settingsBtnRef = useRef(null);
  const settingsAnchorRef = useRef(null);
  const [settingsPosition, setSettingsPosition] = useState(null);

  const handleSettingsButtonClick = () => {
    const action = resolveSettingsButtonAction({
      isMobileLayout,
      settingsOpen,
    });

    if (action.settingsOpen) {
      const rect = settingsBtnRef.current?.getBoundingClientRect();
      if (rect) {
        settingsAnchorRef.current = { left: rect.left, top: rect.top };
        setSettingsPosition(
          resolveSettingsPopoverPosition({
            buttonRect: settingsAnchorRef.current,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
          }),
        );
      }
    }
    if (action.closeMobileSidebar) {
      onToggleSidebarOpen(false);
    }
    setSettingsOpen(action.settingsOpen);
  };

  useEffect(() => {
    if (!settingsOpen) {
      settingsAnchorRef.current = null;
      setSettingsPosition(null);
      return;
    }

    if (!settingsAnchorRef.current) {
      const rect = settingsBtnRef.current?.getBoundingClientRect();
      if (rect) {
        settingsAnchorRef.current = { left: rect.left, top: rect.top };
      }
    }

    const updatePosition = () => {
      if (!settingsAnchorRef.current) return;
      setSettingsPosition(
        resolveSettingsPopoverPosition({
          buttonRect: settingsAnchorRef.current,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        }),
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e) => {
      if (
        !panelRef.current?.contains(e.target) &&
        !settingsBtnRef.current?.contains(e.target)
      ) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        setSettingsOpen(false);
        if (!isMobileLayout || isSidebarOpen) {
          settingsBtnRef.current?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isMobileLayout, isSidebarOpen, settingsOpen]);

  return (
    <>
      <aside
        id="app-sidebar"
        className={`sidebar ${isMobileLayout ? "mobile" : "desktop"} ${isSidebarOpen ? "open" : ""} ${isDesktopSidebarCollapsed ? "collapsed" : ""}`}
        style={sidebarStyle}
        aria-hidden={isMobileLayout ? !isSidebarOpen : undefined}
      >
        {isDesktopSidebarCollapsed ? (
          <div className="sidebar-collapsed-header">
            <div className="sidebar-collapsed-logo-wrap">
              <img className="sidebar-logo-light" src="/assets/assets/codex-telegram-icon-black.svg" alt="" aria-hidden="true" />
              <img className="sidebar-logo-dark" src="/assets/assets/codex-telegram-icon-ivory.svg" alt="" aria-hidden="true" />
            </div>
            <button
              type="button"
              className="sidebar-toggle-btn sidebar-expand-btn"
              onClick={onToggleSidebarCollapsed}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <SidebarToggleIcon collapsed={true} />
            </button>
          </div>
        ) : (
          <div className="sidebar-content">{children}</div>
        )}
        <div className="sidebar-footer">
          <button
            ref={settingsBtnRef}
            type="button"
            className={`sidebar-settings-btn${settingsOpen ? " active" : ""}`}
            onClick={handleSettingsButtonClick}
            aria-expanded={settingsOpen}
            aria-controls={panelId}
            aria-label="Agent Settings"
            title="Agent Settings"
          >
            <SettingsIcon />
            {!isDesktopSidebarCollapsed ? (
              <span className="sidebar-settings-label">Settings</span>
            ) : null}
          </button>
        </div>
      </aside>
      {settingsOpen ? (
        <div
          ref={panelRef}
          id={panelId}
          className="sidebar-settings-popover"
          role="dialog"
          aria-label="Agent Settings"
          style={settingsPosition ?? undefined}
        >
          {settingsContent}
        </div>
      ) : null}
      {isMobileLayout ? (
        <button
          className={`sidebar-backdrop ${isSidebarOpen ? "open" : ""}`}
          type="button"
          onClick={() => onToggleSidebarOpen(false)}
          aria-label="Close navigation menu"
        />
      ) : !isDesktopSidebarCollapsed ? (
        <div
          className={`sidebar-resizer ${isResizingSidebar ? "active" : ""}`}
          onMouseDown={onStartSidebarResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
        />
      ) : (
        <div className="sidebar-resizer sidebar-resizer-collapsed" aria-hidden="true" />
      )}
    </>
  );
}
