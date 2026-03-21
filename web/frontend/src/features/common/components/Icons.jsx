export function ThemeIcon({ theme }) {
  if (theme === "light") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11 2h2v3h-2zM11 19h2v3h-2zM2 11h3v2H2zM19 11h3v2h-3zM5.64 4.22l2.12 2.12-1.42 1.41-2.12-2.12zM16.24 14.83l2.12 2.12-1.42 1.41-2.12-2.12zM4.22 18.36l2.12-2.12 1.41 1.42-2.12 2.12zM16.83 7.76l2.12-2.12 1.41 1.42-2.12 2.12zM12 7a5 5 0 1 0 5 5 5 5 0 0 0-5-5z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.04 2.3a8.74 8.74 0 0 0-1.69 5.19 8.9 8.9 0 0 0 8.89 8.89 8.74 8.74 0 0 0 .46-.01A9 9 0 1 1 14.04 2.3Z" />
    </svg>
  );
}

export function SidebarChevronIcon({ collapsed }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {collapsed ? (
        <path d="M8.59 7.41 10 6l6 6-6 6-1.41-1.41L13.17 12 8.59 7.41Zm-4 0L6 6l6 6-6 6-1.41-1.41L9.17 12 4.59 7.41Z" />
      ) : (
        <path d="m15.41 7.41-1.41-1.41-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59Zm4 0L18 6l-6 6 6 6 1.41-1.41L14.83 12l4.58-4.59Z" />
      )}
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.4 20.4 21 12 3.4 3.6l.02 6.53 12.58 1.87-12.58 1.87-.02 6.53Z" />
    </svg>
  );
}

export function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7h10v10H7z" />
    </svg>
  );
}

export function NotificationIcon({ enabled }) {
  if (!enabled) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2v1h16v-1zM9.6 20a2.4 2.4 0 0 0 4.8 0" />
        <path d="M5 5l14 14" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2v1h16v-1zM9.6 20a2.4 2.4 0 0 0 4.8 0" />
    </svg>
  );
}

export function NewChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5c-4.42 0-8 2.91-8 6.5 0 2.02 1.13 3.82 2.9 5.01L6 20l3.63-1.98c.76.17 1.55.26 2.37.26 4.42 0 8-2.91 8-6.5S16.42 5 12 5Zm1 6h3v2h-3v3h-2v-3H8v-2h3V8h2v3Z" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 12.65-5.65Z" />
    </svg>
  );
}

export function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7Zm-5 16a3 3 0 1 1 3-3 3 3 0 0 1-3 3Zm3-10H5V5h10Z" />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.14 12.94a7.43 7.43 0 0 0 .05-.94 7.43 7.43 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.28 7.28 0 0 0-1.63-.94L14.4 2.8a.49.49 0 0 0-.49-.4h-3.84a.49.49 0 0 0-.49.4l-.36 2.52c-.58.23-1.13.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.68 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.43 7.43 0 0 0-.05.94 7.43 7.43 0 0 0 .05.94L2.8 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.52a.49.49 0 0 0 .49.4h3.84a.49.49 0 0 0 .49-.4l.36-2.52c.58-.23 1.13-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
    </svg>
  );
}

export function ChevronIcon({ expanded = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {expanded ? <path d="M7 10l5 5 5-5z" /> : <path d="M10 7l5 5-5 5z" />}
    </svg>
  );
}

export function FolderIcon({ open = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {open ? (
        <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
      ) : (
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5v1H4zM4 10h16v6.5A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
      )}
    </svg>
  );
}

export function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 3h7L19 8.5v11A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3Zm6 1.5V9h4.5" />
    </svg>
  );
}
