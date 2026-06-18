import type { LabelHTMLAttributes, ReactNode } from "react";

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
  const classes = ["ui-form-field", className].filter(Boolean).join(" ");
  const helpClasses = ["ui-form-field-help", helpClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={classes} {...props}>
      <span className="ui-form-field-label">{label}</span>
      {children}
      {help ? <span className={helpClasses}>{help}</span> : null}
    </label>
  );
}
