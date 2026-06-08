import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className = "", ...props }, ref) {
  const classes = ["ui-textarea", className].filter(Boolean).join(" ");
  return <textarea ref={ref} className={classes} {...props} />;
});

export default Textarea;
