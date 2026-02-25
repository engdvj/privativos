import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TableActionsProps {
  children: ReactNode;
  className?: string;
}

export function TableActions({ children, className }: TableActionsProps) {
  return <div className={cn("flex justify-end gap-2", className)}>{children}</div>;
}
