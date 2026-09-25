import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

export default function Panel({ children, className = "", ...props }: PanelProps) {
  return (
    <div className={cn("ui-panel", "panel", className)} {...props}>
      {children}
    </div>
  );
}
