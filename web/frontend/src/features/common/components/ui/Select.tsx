import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className = "", ...props },
  ref
) {
  const classes = ["ui-select", className].filter(Boolean).join(" ");
  return <select ref={ref} className={classes} {...props} />;
});

export default Select;
