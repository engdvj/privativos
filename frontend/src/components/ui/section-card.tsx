import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export function SectionCard({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  headerClassName,
  contentClassName,
}: SectionCardProps) {
  return (
    <Card className={cn("animate-fade-up", className)}>
      <CardHeader className={cn("gap-3 pb-3", headerClassName)}>
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <CardTitle className="flex items-center gap-2 text-lg animate-in fade-in-0 slide-in-from-left-2">
            {Icon ? <Icon className="h-5 w-5 text-primary" /> : null}
            {title}
          </CardTitle>
          {actions ? (
            <div
              className="flex w-full flex-wrap items-center gap-2 sm:w-auto animate-in fade-in-0 slide-in-from-right-2"
              style={{ animationDelay: "60ms" }}
            >
              {actions}
            </div>
          ) : null}
        </div>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
