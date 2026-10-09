import type { ReactNode } from "react";
import type { CompanySectionId } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { ShareSection } from "./ShareSection";

export interface CompanySectionProps {
  id: CompanySectionId;
  title: string;
  /** One line under the title. */
  description?: ReactNode;
  symbol: string;
  children: ReactNode;
  className?: string;
}

/** A page section with a stable DOM id (the deep-link hash), a heading and a copy-link control. */
export function CompanySection({ id, title, description, symbol, children, className }: CompanySectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-40 rounded-lg border bg-card p-3 sm:p-4", className)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-base font-semibold leading-tight">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        <ShareSection symbol={symbol} sectionId={id} sectionLabel={title} />
      </div>
      {children}
    </section>
  );
}
