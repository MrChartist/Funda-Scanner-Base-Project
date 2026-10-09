import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** A friendly, illustration-free loading line (announced politely to assistive tech). */
export function LoadingState({ children = "Loading…", className }: { children?: ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground", className)}>
      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {children}
    </div>
  );
}
