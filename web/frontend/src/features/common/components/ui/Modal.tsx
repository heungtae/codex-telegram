import type { MouseEvent, ReactNode } from "react";
import { cn } from "./cn";

type ModalProps = {
  ariaLabel: string;
  children?: ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
};

export default function Modal({ ariaLabel, children, className = "", isOpen, onClose, title }: ModalProps) {
  if (!isOpen) {
    return null;
  }

  const cardClasses = cn("modal-card", "ui-modal-card", className);
  const stopDialogMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div className="modal-backdrop ui-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className={cardClasses}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onMouseDown={stopDialogMouseDown}
      >
        {title && (
          <>
            <div className="modal-header">
              <span className="modal-header-title">{title}</span>
              <button className="modal-close-btn" type="button" onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>
            <div className="modal-divider" />
          </>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
