import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusTone = "success" | "danger" | "warning" | "info" | "neutral";

const toneClassName: Record<StatusTone, string> = {
  success: "bg-success/14 text-success",
  danger: "bg-destructive/14 text-destructive",
  warning: "bg-warning/16 text-warning-foreground dark:bg-warning/24 dark:text-warning",
  info: "bg-primary/14 text-primary",
  neutral: "bg-muted text-muted-foreground",
};

interface StatusPillProps {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}

export function StatusPill({ children, tone = "neutral", className }: StatusPillProps) {
  return (
    <Badge variant="outline" className={cn("border-transparent", toneClassName[tone], className)}>
      {children}
    </Badge>
  );
}
