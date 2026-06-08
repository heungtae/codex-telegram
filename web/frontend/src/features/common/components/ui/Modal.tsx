import type { MouseEvent, ReactNode } from "react";

type ModalProps = {
  ariaLabel: string;
  children?: ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function Modal({ ariaLabel, children, className = "", isOpen, onClose }: ModalProps) {
  if (!isOpen) {
    return null;
  }

  const cardClasses = ["modal-card", "ui-modal-card", className].filter(Boolean).join(" ");
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
        {children}
      </div>
    </div>
  );
}
