import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className = "", type = "text", ...props }: InputProps) {
  const classes = ["ui-input", className].filter(Boolean).join(" ");
  return <input type={type} className={classes} {...props} />;
}
