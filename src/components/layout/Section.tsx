import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  id?: string;
  className?: string;
  children: ReactNode;
}

/** A titled block. The heading is the shared small-caps eyebrow with an accent bar (`.section-title`). */
export function Section({ title, description, actions, id, className, children }: SectionProps) {
  return (
    <section id={id} className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <h2 className="section-title">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
