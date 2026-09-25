import type { LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type FormFieldProps = LabelHTMLAttributes<HTMLLabelElement> & {
  children?: ReactNode;
  help?: ReactNode;
  helpClassName?: string;
  label: ReactNode;
};

export default function FormField({
  children,
  className = "",
  help,
  helpClassName = "",
  label,
  ...props
}: FormFieldProps) {
  return (
    <label className={cn("ui-form-field", className)} {...props}>
      <span className="ui-form-field-label">{label}</span>
      {children}
      {help ? <span className={cn("ui-form-field-help", helpClassName)}>{help}</span> : null}
    </label>
  );
}
