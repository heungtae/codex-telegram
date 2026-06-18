import type { HTMLAttributes, ReactNode } from "react";

type BadgeVariant = "neutral" | "accent";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children?: ReactNode;
  variant?: BadgeVariant;
};

export default function Badge({ children, className = "", variant = "neutral", ...props }: BadgeProps) {
  const classes = ["ui-badge", `ui-badge-${variant}`, className].filter(Boolean).join(" ");
  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}
