import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label?: ReactNode;
  htmlFor?: string;
  helperText?: ReactNode;
  errorText?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  helperText,
  errorText,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
      {errorText ? (
        <p className="text-xs text-destructive">{errorText}</p>
      ) : helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}
