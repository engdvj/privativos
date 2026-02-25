import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn("flex w-full flex-wrap items-center gap-2 sm:w-auto", className)}>
      {children}
    </div>
  );
}
