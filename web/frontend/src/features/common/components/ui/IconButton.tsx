import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  children?: ReactNode;
};

export default function IconButton({
  active = false,
  children,
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button type={type} className={cn("ui-icon-button", active && "is-active", className)} {...props}>
      {children}
    </button>
  );
}
