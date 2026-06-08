import type { HTMLAttributes, ReactNode } from "react";

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

export default function Panel({ children, className = "", ...props }: PanelProps) {
  const classes = ["ui-panel", "panel", className].filter(Boolean).join(" ");
  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
