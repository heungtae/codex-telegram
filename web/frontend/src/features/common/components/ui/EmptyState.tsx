import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

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
  return (
    <div className={cn("ui-empty-state", `ui-empty-state-${tone}`, className)} {...props}>
      {children}
    </div>
  );
}
