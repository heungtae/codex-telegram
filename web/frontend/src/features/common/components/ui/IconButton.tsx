import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  active?: boolean;
  ariaLabel: string;
  children?: ReactNode;
};

export default function IconButton({
  active = false,
  ariaLabel,
  children,
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  const classes = ["ui-icon-button", active ? "is-active" : "", className].filter(Boolean).join(" ");
  return (
    <button type={type} className={classes} aria-label={ariaLabel} {...props}>
      {children}
    </button>
  );
}
