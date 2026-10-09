import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** A calm, explanatory empty state ("No companies match", "Annual statements were not provided"). */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div role="status" className={cn("flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center", className)}>
      <div className="text-muted-foreground" aria-hidden="true">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <p className="text-sm font-medium">{title}</p>
      {description && <div className="max-w-prose text-sm text-muted-foreground">{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
