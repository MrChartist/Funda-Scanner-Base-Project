import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageShellProps {
  children: ReactNode;
  className?: string;
  /** Cap child blocks at a comfortable reading measure (~74ch) while keeping the shared left edge. */
  prose?: boolean;
}

/** The one page container: same width, gutters and left edge as the header, banner and footer. */
export function PageShell({ children, className, prose = false }: PageShellProps) {
  return (
    <div className={cn("app-container animate-page-in min-w-0 space-y-6 py-6 md:py-8", prose && "page-prose", className)}>
      {children}
    </div>
  );
}
