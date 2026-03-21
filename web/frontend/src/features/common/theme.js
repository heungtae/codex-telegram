import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  TURN_NOTIFICATION_STORAGE_KEY,
} from "./constants";

export function normalizeTheme(theme) {
  return theme === "light" ? "light" : "dark";
}

export function readDocumentTheme() {
  if (typeof document === "undefined") {
    return DEFAULT_THEME;
  }
  return normalizeTheme(document.documentElement.dataset.theme);
}

export function applyDocumentTheme(theme) {
  if (typeof document === "undefined") {
    return;
  }
  const nextTheme = normalizeTheme(theme);
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme;
}

export function persistTheme(theme) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, normalizeTheme(theme));
  } catch (_err) {}
}

export function readTurnNotificationEnabled() {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    const value = window.localStorage.getItem(TURN_NOTIFICATION_STORAGE_KEY);
    if (value === "0") {
      return false;
    }
    if (value === "1") {
      return true;
    }
  } catch (_err) {}
  return true;
}

export function persistTurnNotificationEnabled(enabled) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(TURN_NOTIFICATION_STORAGE_KEY, enabled ? "1" : "0");
  } catch (_err) {}
}
