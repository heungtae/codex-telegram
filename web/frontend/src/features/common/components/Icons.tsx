import {
  Bell,
  BellOff,
  Check,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  FileCode,
  Folder,
  FolderClosed,
  FolderOpen,
  Maximize,
  Menu,
  MessageSquare,
  Minimize,
  Moon,
  PanelLeft,
  PanelRight,
  Plus,
  RotateCw,
  Save,
  SendHorizontal,
  Settings,
  Square,
  SquarePen,
  Sun,
  Trash2,
  X,
} from "lucide-react";

const iconProps = {
  "aria-hidden": true,
  focusable: false,
  strokeWidth: 2,
};

export function ThemeIcon({ theme }) {
  const Icon = theme === "light" ? Sun : Moon;
  return <Icon {...iconProps} />;
}

export function SidebarToggleIcon({ collapsed: _collapsed = false }) {
  return <PanelLeft {...iconProps} />;
}

export function PanelRightIcon() {
  return <PanelRight {...iconProps} />;
}

export function SendIcon() {
  return <SendHorizontal {...iconProps} />;
}

export function StopIcon() {
  return <Square {...iconProps} />;
}

export function NotificationIcon({ enabled }) {
  const Icon = enabled ? Bell : BellOff;
  return <Icon {...iconProps} />;
}

export function NewChatIcon() {
  return <Plus {...iconProps} />;
}

export function RefreshIcon() {
  return <RotateCw {...iconProps} />;
}

export function SaveIcon() {
  return <Save {...iconProps} />;
}

export function SettingsIcon() {
  return <Settings {...iconProps} />;
}

export function MenuIcon() {
  return <Menu {...iconProps} />;
}

export function ChevronIcon({ expanded = false }) {
  const Icon = expanded ? ChevronDown : ChevronRight;
  return <Icon {...iconProps} />;
}

export function FolderIcon({ open = false }) {
  const Icon = open ? FolderOpen : Folder;
  return <Icon {...iconProps} />;
}

export function ExpandIcon({ expanded = false }) {
  const Icon = expanded ? Minimize : Maximize;
  return <Icon {...iconProps} />;
}

export function FileIcon() {
  return <FileCode {...iconProps} />;
}

export function CloseIcon() {
  return <X {...iconProps} />;
}

export function MoreIcon() {
  return <Ellipsis {...iconProps} />;
}

export function ComposeIcon() {
  return <SquarePen {...iconProps} />;
}

export function CheckIcon() {
  return <Check {...iconProps} />;
}

export function PlusIcon() {
  return <Plus {...iconProps} />;
}

export function TrashIcon() {
  return <Trash2 {...iconProps} />;
}

export function ThreadIcon() {
  return <MessageSquare {...iconProps} />;
}

export function ProjectIcon() {
  return <FolderClosed {...iconProps} />;
}
