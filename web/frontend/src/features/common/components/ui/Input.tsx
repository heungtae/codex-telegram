import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className = "", type = "text", ...props }: InputProps) {
  return <input type={type} className={cn("ui-input", className)} {...props} />;
}
