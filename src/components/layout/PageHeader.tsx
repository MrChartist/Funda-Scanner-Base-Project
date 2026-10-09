import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: ReactNode;
  /** One short line under the title. */
  description?: ReactNode;
  /** Small label above the title. */
  eyebrow?: ReactNode;
  icon?: LucideIcon;
  /** Buttons or controls aligned to the right (wrap below the title on narrow screens). */
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** Page title block: optional icon and eyebrow, h1, one-line description, and actions. */
export function PageHeader({ title, description, eyebrow, icon: Icon, actions, className, children }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-x-6 gap-y-3", className)}>
      <div className="flex min-w-0 flex-1 basis-80 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 space-y-1">
          {eyebrow && <p className="type-label text-primary">{eyebrow}</p>}
          <h1 className="type-page-title">{title}</h1>
          {description && <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>}
          {children}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
