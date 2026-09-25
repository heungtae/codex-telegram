import { AlertTriangle, Check, Info, X } from "lucide-react";
import type { ReactNode } from "react";

type ToastVariant = "info" | "success" | "error" | "warning";

type ToastProps = {
  message: ReactNode;
  subtitle?: string;
  variant?: ToastVariant;
  onClose?: () => void;
};

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const props = { size: 16, "aria-hidden": true } as const;
  if (variant === "success") return <Check {...props} />;
  if (variant === "error" || variant === "warning") return <AlertTriangle {...props} />;
  return <Info {...props} />;
}

export default function Toast({ message, subtitle, variant = "info", onClose }: ToastProps) {
  const role = variant === "error" ? "alert" : "status";
  const ariaLive = variant === "error" ? "assertive" : "polite";

  return (
    <div
      className={`ui-toast ui-toast-${variant} toast-notification`}
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
    >
      <span className="toast-icon">
        <ToastIcon variant={variant} />
      </span>
      <div className="toast-body">
        <span className="toast-message">{message}</span>
        {subtitle && <span className="toast-user-prompt">{subtitle}</span>}
      </div>
      {onClose && (
        <button className="toast-close" onClick={onClose} aria-label="Close">
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}
