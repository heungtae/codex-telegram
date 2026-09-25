import { useId, useState } from "react";
import type { ReactNode } from "react";
import { ChevronIcon } from "./Icons";

type CollapsibleSectionProps = {
  title: ReactNode;
  defaultOpen?: boolean;
  sectionClassName: string;
  headClassName?: string;
  toggleClassName: string;
  labelClassName: string;
  chevronClassName: string;
  listClassName: string;
  headerActions?: ReactNode;
  children: ReactNode;
};

export default function CollapsibleSection({
  title,
  defaultOpen = true,
  sectionClassName,
  headClassName = "panel-head",
  toggleClassName,
  labelClassName,
  chevronClassName,
  listClassName,
  headerActions,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const listId = useId();

  return (
    <section className={sectionClassName}>
      <div className={headClassName}>
        <button
          type="button"
          className={`${toggleClassName}${isOpen ? " open" : ""}`}
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          aria-controls={listId}
        >
          <span className={labelClassName}>{title}</span>
          <span className={chevronClassName}>
            <ChevronIcon expanded={isOpen} />
          </span>
        </button>
        {headerActions}
      </div>
      {isOpen ? <div id={listId} className={listClassName}>{children}</div> : null}
    </section>
  );
}
