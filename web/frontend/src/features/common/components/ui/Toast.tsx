import type { ReactNode } from "react";

type ToastVariant = "info" | "success" | "error";

type ToastProps = {
  message: ReactNode;
  variant?: ToastVariant;
};

export default function Toast({ message, variant = "info" }: ToastProps) {
  const role = variant === "error" ? "alert" : "status";
  const ariaLive = variant === "error" ? "assertive" : "polite";

  return (
    <div
      className={`ui-toast ui-toast-${variant} toast-notification`}
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
    >
      <span className="toast-message">{message}</span>
    </div>
  );
}
