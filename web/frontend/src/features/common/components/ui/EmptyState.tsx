import type { HTMLAttributes, ReactNode } from "react";

type EmptyStateTone = "default" | "notice";

type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  tone?: EmptyStateTone;
};

export default function EmptyState({
  children,
  className = "",
  tone = "default",
  ...props
}: EmptyStateProps) {
  const classes = [
    "ui-empty-state",
    `ui-empty-state-${tone}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
