import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-1 py-2" : "gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-7",
        className,
      )}
    >
      {Icon ? (
        <div className={cn("grid place-items-center rounded-full bg-muted text-muted-foreground", compact ? "h-7 w-7" : "h-10 w-10")}> 
          <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </div>
      ) : null}
      <p className={cn("font-medium text-foreground", compact ? "text-sm" : "text-base")}>{title}</p>
      {description ? (
        <p className={cn("text-muted-foreground", compact ? "text-xs" : "max-w-md text-sm")}>{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
