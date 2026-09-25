import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type BadgeVariant = "neutral" | "accent";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children?: ReactNode;
  variant?: BadgeVariant;
};

export default function Badge({ children, className = "", variant = "neutral", ...props }: BadgeProps) {
  return (
    <span className={cn("ui-badge", `ui-badge-${variant}`, className)} {...props}>
      {children}
    </span>
  );
}
